"""Dumps the Azure CLI command table as JSON on stdout (consumed by generate-catalog-azure-v1.mjs).

It loads every command and argument definition once, in-process, instead of running `az <cmd> -h`
for each of the ~6,000 commands. It must run with the Python that has azure-cli installed
(for the packaged CLI that is /opt/az/bin/python3, see generate-catalog-azure-v1.mjs --python).

Usage:
  python generate-catalog-azure-dump.py [--services vm,storage]

Progress and warnings go to stderr; stdout carries only the JSON document:
  { "version": "2.91.0", "groups": { "<service>": "<description>" },
    "commands": [ { "name": "vm create", "desc": "...", "params": [
        { "flag": "--name", "required": true, "boolean": false, "choices": [...], "desc": "..." } ] } ] }
"""

import argparse
import json
import os
import sys
import time

os.environ.setdefault('AZURE_CORE_COLLECT_TELEMETRY', 'false')
os.environ.setdefault('AZURE_CORE_NO_COLOR', 'true')
os.environ.setdefault('AZURE_CORE_ONLY_SHOW_ERRORS', 'true')

SUPPRESS = '==SUPPRESS=='


def log(message):
    print(message, file=sys.stderr, flush=True)


def load_cli():
    """Builds the CLI and loads the whole command table plus every argument definition."""
    from azure.cli.core import get_default_cli

    cli = get_default_cli()
    invocation = cli.invocation_cls(cli_ctx=cli, parser_cls=cli.parser_cls,
                                    commands_loader_cls=cli.commands_loader_cls, help_cls=cli.help_cls)
    cli.invocation = invocation  # some module loaders read cli_ctx.invocation
    loader = invocation.commands_loader

    started = time.time()
    loader.load_command_table(None)
    log(f'command table: {len(loader.command_table)} commands in {time.time() - started:.1f}s')

    started = time.time()
    loader.load_arguments(None)  # None loads every module (what azure-cli does to build its reference docs)
    log(f'arguments loaded in {time.time() - started:.1f}s')
    return loader


def yaml_help(helps, name):
    """Parses the YAML help text a module registered for a command or group (may be missing)."""
    raw = helps.get(name)
    if not raw:
        return {}
    import yaml
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def one_line(text):
    return ' '.join(str(text or '').split())


def option_flag(options):
    """Returns the flag `az -h` lists first: the alphabetically first long flag, else the first short one."""
    # Some modules pass one string with several flags ("--id, --client-id"); split them.
    names = [part for o in (options or []) for part in str(o).replace(',', ' ').split()]
    long_names = sorted(name for name in names if name.startswith('--'))
    if long_names:
        return long_names[0]
    return names[0] if names else None


def parameter_help(doc, options):
    """Help text the module wrote in its YAML, keyed by any of the argument's option strings."""
    wanted = {str(o) for o in (options or [])}
    for entry in doc.get('parameters') or []:
        names = set(str(entry.get('name', '')).split())
        if names & wanted:
            return entry.get('short-summary') or entry.get('long-summary') or ''
    return ''


def build_command(name, command, helps, registry):
    doc = yaml_help(helps, name)
    # Where `az -h` gets the summary: the module's YAML, else the AAZ command's own help dict, else the docstring.
    own_help = command.help if isinstance(command.help, dict) else {}
    desc = doc.get('short-summary') or own_help.get('short-summary')
    if not desc:
        raw = getattr(command, 'description', None)
        try:
            desc = raw() if callable(raw) else raw
        except Exception:  # lazy docstring loading imports SDK models and may fail
            desc = ''
    desc = one_line(desc)
    if desc and desc[-1] not in '.!?:':
        desc += '.'  # `az -h` prints every summary as a sentence
    merged = []
    for dest, arg in command.arguments.items():
        settings = dict(arg.type.settings)
        # Same merge knack does at run time: the registry holds the per-command overrides.
        override = registry.get_cli_argument(name, dest)
        if override is not None:
            settings.update(override.settings)
        merged.append(settings)

    # azure-cli (commands/arm.py, register_ids_argument) adds --ids at invocation time to every non-create
    # command with a resource name, and the id-part arguments stop being required (--ids can replace them).
    id_parts = [s.get('id_part') for s in merged]
    takes_ids = name.split()[-1] != 'create' and ('name' in id_parts or 'resource_name' in id_parts)
    if takes_ids:
        for settings in merged:
            if settings.get('id_part'):
                settings['required'] = False
        merged.append({
            'options_list': ['--ids'],
            'help': "One or more resource IDs (space-delimited). It should be a complete resource ID containing "
                    "all information of 'Resource Id' arguments. You should provide either --ids or other "
                    "'Resource Id' arguments.",
        })

    params = []
    seen = set()
    for settings in merged:
        options = settings.get('options_list')
        flag = option_flag(options)
        if not flag or not flag.startswith('-'):
            continue
        if settings.get('help') == SUPPRESS or flag in seen:
            continue
        seen.add(flag)

        choices = settings.get('choices')
        choices = [str(c) for c in choices] if choices and not callable(choices) else []
        # Same rule as the help crawler: only true/false value lists are "boolean" (flags with no value stay string).
        is_bool = len(choices) == 2 and {c.lower() for c in choices} == {'true', 'false'}
        text = one_line(parameter_help(doc, options) or settings.get('help'))
        if choices and not is_bool and 'Allowed values' not in text:
            text = f'{text} Allowed values: {", ".join(choices)}.'.strip()
        params.append({
            'flag': flag,
            'required': bool(settings.get('required')),
            'boolean': is_bool,
            'choices': choices,
            'desc': text,
        })

    return {'name': name, 'desc': desc, 'params': params}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--services', default='')
    args = parser.parse_args()
    services = {s.strip() for s in args.services.split(',') if s.strip()}

    from knack.help_files import helps
    from azure.cli.core import __version__

    loader = load_cli()
    registry = loader.argument_registry

    commands = []
    groups = {}
    for name, command in sorted(loader.command_table.items()):
        # Root-level commands (login, logout, rest, version…) are grouped under a pseudo-service "general".
        root = ' ' not in name
        service = 'general' if root else name.split(' ', 1)[0]
        if services and service not in services:
            continue
        built = build_command(name, command, helps, registry)
        if root:
            built['name'] = 'general ' + name
        commands.append(built)
        if service not in groups:
            groups[service] = 'Root-level commands (login, logout, rest, version…).' if root else one_line(yaml_help(helps, service).get('short-summary'))
    log(f'dumped {len(commands)} commands in {len(groups)} services')
    json.dump({'version': __version__, 'groups': groups, 'commands': commands}, sys.stdout)


if __name__ == '__main__':
    main()
