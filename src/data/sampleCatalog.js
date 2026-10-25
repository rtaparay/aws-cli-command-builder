// Muestra de catálogo incluida como respaldo sin conexión.
// El catálogo completo se carga desde catalog.json al iniciar la app.
export const SAMPLE_CATALOG = [
  {
    id: "ec2", name: "Amazon Elastic Compute Cloud", commands: [
      {
        name: "run-instances", desc: "Lanza una o más instancias EC2 con la AMI y el tipo indicados.",
        required: [
          { flag: "--image-id", type: "string", desc: "ID de la AMI (p. ej. ami-0abcd1234)." },
        ],
        optional: [
          { flag: "--instance-type", type: "string", desc: "Tipo de instancia, p. ej. t3.micro." },
          { flag: "--key-name", type: "string", desc: "Nombre del par de claves para SSH." },
          { flag: "--count", type: "integer", desc: "Número de instancias a lanzar." },
          { flag: "--subnet-id", type: "string", desc: "Subred donde se lanza la instancia." },
          { flag: "--dry-run", type: "boolean", desc: "Comprueba permisos sin ejecutar la acción." },
        ]
      },
      {
        name: "describe-instances", desc: "Describe una o más de tus instancias EC2.",
        required: [],
        optional: [
          { flag: "--instance-ids", type: "list<string>", desc: "IDs de instancia a describir." },
          { flag: "--filters", type: "list<structure>", desc: "Filtros, p. ej. Name=instance-state-name,Values=running." },
          { flag: "--max-items", type: "integer", desc: "Máximo de elementos a devolver." },
        ]
      },
      {
        name: "accept-address-transfer", desc: "Acepta la transferencia de una dirección IP elástica.",
        required: [
          { flag: "--address", type: "string", desc: "La IP elástica que aceptas transferir." },
        ],
        optional: [
          { flag: "--tag-specifications", type: "list<structure>", desc: "Etiquetas a aplicar al recurso." },
          { flag: "--dry-run", type: "boolean", desc: "Comprueba permisos sin ejecutar la acción." },
        ]
      },
      {
        name: "terminate-instances", desc: "Termina una o más instancias EC2.",
        required: [{ flag: "--instance-ids", type: "list<string>", desc: "IDs de las instancias a terminar." }],
        optional: [{ flag: "--dry-run", type: "boolean", desc: "Comprueba permisos sin ejecutar la acción." }]
      },
    ]
  },
  {
    id: "s3api", name: "Amazon Simple Storage Service (bajo nivel)", commands: [
      {
        name: "list-buckets", desc: "Lista todos los buckets de tu cuenta.", required: [], optional: [
          { flag: "--max-buckets", type: "integer", desc: "Máximo de buckets por página." },
        ]
      },
      {
        name: "get-object", desc: "Descarga un objeto de un bucket.",
        required: [
          { flag: "--bucket", type: "string", desc: "Nombre del bucket." },
          { flag: "--key", type: "string", desc: "Clave (ruta) del objeto." },
        ],
        optional: [
          { flag: "--version-id", type: "string", desc: "Versión específica del objeto." },
          { flag: "--range", type: "string", desc: "Rango de bytes a descargar." },
        ]
      },
      {
        name: "put-object", desc: "Sube un objeto a un bucket.",
        required: [
          { flag: "--bucket", type: "string", desc: "Nombre del bucket." },
          { flag: "--key", type: "string", desc: "Clave (ruta) destino del objeto." },
        ],
        optional: [
          { flag: "--body", type: "blob", desc: "Ruta del archivo a subir." },
          { flag: "--content-type", type: "string", desc: "Tipo MIME del objeto." },
          { flag: "--acl", type: "string", desc: "ACL predefinida, p. ej. private." },
        ]
      },
    ]
  },
  {
    id: "iam", name: "AWS Identity and Access Management", commands: [
      {
        name: "create-user", desc: "Crea un nuevo usuario IAM.",
        required: [{ flag: "--user-name", type: "string", desc: "Nombre del usuario a crear." }],
        optional: [
          { flag: "--path", type: "string", desc: "Ruta del usuario, por defecto /." },
          { flag: "--tags", type: "list<structure>", desc: "Etiquetas del usuario." },
        ]
      },
      {
        name: "attach-user-policy", desc: "Adjunta una política gestionada a un usuario.",
        required: [
          { flag: "--user-name", type: "string", desc: "Usuario al que adjuntar la política." },
          { flag: "--policy-arn", type: "string", desc: "ARN de la política gestionada." },
        ], optional: []
      },
      {
        name: "list-users", desc: "Lista los usuarios IAM de la cuenta.", required: [], optional: [
          { flag: "--path-prefix", type: "string", desc: "Filtra por prefijo de ruta." },
          { flag: "--max-items", type: "integer", desc: "Máximo de elementos." },
        ]
      },
    ]
  },
  {
    id: "lambda", name: "AWS Lambda", commands: [
      {
        name: "invoke", desc: "Invoca una función Lambda.",
        required: [{ flag: "--function-name", type: "string", desc: "Nombre o ARN de la función." }],
        optional: [
          { flag: "--payload", type: "blob", desc: "Entrada JSON para la función." },
          { flag: "--invocation-type", type: "string", desc: "RequestResponse | Event | DryRun." },
          { flag: "--log-type", type: "string", desc: "Tail para devolver los últimos logs." },
        ]
      },
      {
        name: "create-function", desc: "Crea una función Lambda.",
        required: [
          { flag: "--function-name", type: "string", desc: "Nombre de la función." },
          { flag: "--runtime", type: "string", desc: "Runtime, p. ej. python3.12." },
          { flag: "--role", type: "string", desc: "ARN del rol de ejecución." },
          { flag: "--handler", type: "string", desc: "Punto de entrada, p. ej. app.handler." },
        ],
        optional: [
          { flag: "--memory-size", type: "integer", desc: "Memoria en MB." },
          { flag: "--timeout", type: "integer", desc: "Timeout en segundos." },
        ]
      },
    ]
  },
];


