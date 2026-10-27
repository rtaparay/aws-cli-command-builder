// The full catalog is loaded from catalog.json when the app starts.
const SAMPLE_CATALOG = [
  {
    id: "ec2", name: "Amazon Elastic Compute Cloud", commands: [
      {
        name: "run-instances", desc: "Launches one or more EC2 instances with the specified AMI and instance type.",
        required: [
          { flag: "--image-id", type: "string", desc: "AMI ID (e.g. ami-0abcd1234)." },
        ],
        optional: [
          { flag: "--instance-type", type: "string", desc: "Instance type, e.g. t3.micro." },
          { flag: "--key-name", type: "string", desc: "Name of the key pair for SSH." },
          { flag: "--count", type: "integer", desc: "Number of instances to launch." },
          { flag: "--subnet-id", type: "string", desc: "Subnet where the instance is launched." },
          { flag: "--dry-run", type: "boolean", desc: "Checks permissions without performing the action." },
        ]
      },
      {
        name: "describe-instances", desc: "Describes one or more of your EC2 instances.",
        required: [],
        optional: [
          { flag: "--instance-ids", type: "list<string>", desc: "Instance IDs to describe." },
          { flag: "--filters", type: "list<structure>", desc: "Filters, e.g. Name=instance-state-name,Values=running." },
          { flag: "--max-items", type: "integer", desc: "Maximum number of items to return." },
        ]
      },
      {
        name: "accept-address-transfer", desc: "Accepts the transfer of an Elastic IP address.",
        required: [
          { flag: "--address", type: "string", desc: "The Elastic IP you accept to transfer." },
        ],
        optional: [
          { flag: "--tag-specifications", type: "list<structure>", desc: "Tags to apply to the resource." },
          { flag: "--dry-run", type: "boolean", desc: "Checks permissions without performing the action." },
        ]
      },
      {
        name: "terminate-instances", desc: "Terminates one or more EC2 instances.",
        required: [{ flag: "--instance-ids", type: "list<string>", desc: "IDs of the instances to terminate." }],
        optional: [{ flag: "--dry-run", type: "boolean", desc: "Checks permissions without performing the action." }]
      },
    ]
  },
  {
    id: "s3api", name: "Amazon Simple Storage Service (low level)", commands: [
      {
        name: "list-buckets", desc: "Lists all buckets in your account.", required: [], optional: [
          { flag: "--max-buckets", type: "integer", desc: "Maximum number of buckets per page." },
        ]
      },
      {
        name: "get-object", desc: "Downloads an object from a bucket.",
        required: [
          { flag: "--bucket", type: "string", desc: "Bucket name." },
          { flag: "--key", type: "string", desc: "Object key (path)." },
        ],
        optional: [
          { flag: "--version-id", type: "string", desc: "Specific version of the object." },
          { flag: "--range", type: "string", desc: "Byte range to download." },
        ]
      },
      {
        name: "put-object", desc: "Uploads an object to a bucket.",
        required: [
          { flag: "--bucket", type: "string", desc: "Bucket name." },
          { flag: "--key", type: "string", desc: "Destination object key (path)." },
        ],
        optional: [
          { flag: "--body", type: "blob", desc: "Path of the file to upload." },
          { flag: "--content-type", type: "string", desc: "MIME type of the object." },
          { flag: "--acl", type: "string", desc: "Canned ACL, e.g. private." },
        ]
      },
    ]
  },
  {
    id: "iam", name: "AWS Identity and Access Management", commands: [
      {
        name: "create-user", desc: "Creates a new IAM user.",
        required: [{ flag: "--user-name", type: "string", desc: "Name of the user to create." }],
        optional: [
          { flag: "--path", type: "string", desc: "User path, defaults to /." },
          { flag: "--tags", type: "list<structure>", desc: "User tags." },
        ]
      },
      {
        name: "attach-user-policy", desc: "Attaches a managed policy to a user.",
        required: [
          { flag: "--user-name", type: "string", desc: "User to attach the policy to." },
          { flag: "--policy-arn", type: "string", desc: "ARN of the managed policy." },
        ], optional: []
      },
      {
        name: "list-users", desc: "Lists the IAM users in the account.", required: [], optional: [
          { flag: "--path-prefix", type: "string", desc: "Filters by path prefix." },
          { flag: "--max-items", type: "integer", desc: "Maximum number of items." },
        ]
      },
    ]
  },
  {
    id: "lambda", name: "AWS Lambda", commands: [
      {
        name: "invoke", desc: "Invokes a Lambda function.",
        required: [{ flag: "--function-name", type: "string", desc: "Function name or ARN." }],
        optional: [
          { flag: "--payload", type: "blob", desc: "JSON input for the function." },
          { flag: "--invocation-type", type: "string", desc: "RequestResponse | Event | DryRun." },
          { flag: "--log-type", type: "string", desc: "Tail to return the last logs." },
        ]
      },
      {
        name: "create-function", desc: "Creates a Lambda function.",
        required: [
          { flag: "--function-name", type: "string", desc: "Function name." },
          { flag: "--runtime", type: "string", desc: "Runtime, e.g. python3.12." },
          { flag: "--role", type: "string", desc: "ARN of the execution role." },
          { flag: "--handler", type: "string", desc: "Entry point, e.g. app.handler." },
        ],
        optional: [
          { flag: "--memory-size", type: "integer", desc: "Memory in MB." },
          { flag: "--timeout", type: "integer", desc: "Timeout in seconds." },
        ]
      },
    ]
  },
];

