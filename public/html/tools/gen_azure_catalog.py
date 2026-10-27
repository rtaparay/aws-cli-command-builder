"""Builds azure-catalog.json (same shape as catalog.json) from the installed azure-cli command modules.
Usage: pip install azure-cli && python tools/gen_azure_catalog.py azure-catalog.json"""
import json, sys, os, re
os.environ.setdefault("AZURE_CORE_COLLECT_TELEMETRY", "false")
from azure.cli.core import get_default_cli
from azure.cli.core import __version__ as core_version
from knack.help_files import helps
import yaml

cli = get_default_cli()
invoker = cli.invocation_cls(cli_ctx=cli, commands_loader_cls=cli.commands_loader_cls,
                             parser_cls=cli.parser_cls, help_cls=cli.help_cls)
cli.invocation = invoker
loader = invoker.commands_loader
cmd_table = loader.load_command_table(None)
loader.load_arguments()  # None = every command via reflection, in one pass
cmd_table = loader.command_table

GLOBAL_DESTS = {"_log_verbosity_verbose", "_log_verbosity_debug", "_log_verbosity_only_show_errors",
                "_output_format", "_jmespath_query", "_subscription", "cmd", "_cmd"}

def clean(t):
    t = re.sub(r"\s+", " ", str(t or "")).strip()
    return t

def help_yaml(name):
    raw = helps.get(name)
    if not raw:
        return {}
    try:
        return yaml.safe_load(raw) or {}
    except Exception:
        return {}

def group_summary(name):
    y = help_yaml(name)
    s = clean(y.get("short-summary"))
    if not s:
        g = loader.command_group_table.get(name)
        hp = getattr(g, "help", None) if g is not None else None
        if isinstance(hp, dict):
            s = clean(hp.get("short-summary"))
    return s

def cmd_summary(name, cmd):
    y = help_yaml(name)
    s = clean(y.get("short-summary"))
    hp = getattr(cmd, "help", None)
    if not s and isinstance(hp, dict):
        s = clean(hp.get("short-summary"))
    if not s:
        d = cmd.description
        if callable(d):
            try: d = d()
            except Exception: d = ""
        s = clean(d)
    return s

def arg_type(settings):
    choices = settings.get("choices")
    action = settings.get("action")
    nargs = settings.get("nargs")
    tp = settings.get("type")
    if action in ("store_true", "store_false") or (isinstance(action, str) and "store_" in action and "const" in action):
        return "boolean"
    if choices:
        try:
            ch = [str(c) for c in choices]
            if set(c.lower() for c in ch) <= {"true", "false"}:
                return "boolean"
        except Exception:
            pass
    base = "string"
    if tp is int: base = "integer"
    elif tp is float: base = "float"
    if nargs in ("+", "*"):
        return "list<" + base + ">"
    return base

services = {}
for name, cmd in sorted(cmd_table.items()):
    if getattr(cmd, "deprecate_info", None):
        continue
    parts = name.split()
    if len(parts) < 2:
        continue
    top = parts[0]
    required, optional = [], []
    for dest, arg in cmd.arguments.items():
        if dest in GLOBAL_DESTS or dest.startswith("_"):
            continue
        st = arg.type.settings
        if st.get("help") == "==SUPPRESS==" or st.get("deprecate_info"):
            continue
        opts = st.get("options_list") or []
        longs = [o for o in opts if isinstance(o, str) and o.startswith("--")]
        if not longs:
            longs = [o for o in opts if isinstance(o, str)]
        if not longs:
            continue
        flag = longs[0]
        hv = st.get("help")
        if isinstance(hv, dict):
            hv = hv.get("short-summary")
        desc = clean(hv)
        choices = st.get("choices")
        t = arg_type(st)
        if choices and t != "boolean":
            try:
                ch = [str(c) for c in choices]
                if len(ch) <= 12:
                    desc = (desc + " Allowed: " + ", ".join(ch) + ".").strip()
            except Exception:
                pass
        p = {"flag": flag, "type": t, "desc": desc[:400]}
        (required if st.get("required") else optional).append(p)
    if not required and not optional and False:
        continue
    svc = services.setdefault(top, {"id": top, "name": group_summary(top) or top, "commands": []})
    svc["commands"].append({"name": " ".join(parts[1:]), "desc": cmd_summary(name, cmd)[:400],
                            "required": required, "optional": optional})

out = {"generated_from": "azure-cli " + core_version, "services": sorted(services.values(), key=lambda s: s["id"])}
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out["services"]), "services", sum(len(s["commands"]) for s in out["services"]), "commands")
