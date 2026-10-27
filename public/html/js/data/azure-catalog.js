// Azure CLI sample. The full catalog is loaded from azure-catalog.json when the app starts.
// A service is an `az` top-level group; a command name may include subgroups ("account create").
const AZURE_SAMPLE_CATALOG = [
  {
    id: "group", name: "Resource groups", commands: [
      {
        name: "create", desc: "Create a new resource group.",
        required: [
          { flag: "--name", type: "string", desc: "Name of the new resource group." },
          { flag: "--location", type: "string", desc: "Location, e.g. eastus." },
        ],
        optional: [
          { flag: "--tags", type: "list<string>", desc: "Space-separated tags: key[=value]." },
          { flag: "--managed-by", type: "string", desc: "ID of the resource that manages this group." },
        ]
      },
      {
        name: "list", desc: "List resource groups.", required: [], optional: [
          { flag: "--tag", type: "string", desc: "A single tag in 'key[=value]' format." },
        ]
      },
      {
        name: "delete", desc: "Delete a resource group.",
        required: [{ flag: "--name", type: "string", desc: "Name of resource group." }],
        optional: [
          { flag: "--yes", type: "boolean", desc: "Do not prompt for confirmation." },
          { flag: "--no-wait", type: "boolean", desc: "Do not wait for the long-running operation to finish." },
        ]
      },
    ]
  },
  {
    id: "vm", name: "Virtual Machines", commands: [
      {
        name: "create", desc: "Create an Azure Virtual Machine.",
        required: [
          { flag: "--name", type: "string", desc: "Name of the virtual machine." },
          { flag: "--resource-group", type: "string", desc: "Name of resource group." },
        ],
        optional: [
          { flag: "--image", type: "string", desc: "Image URN alias, e.g. Ubuntu2204." },
          { flag: "--size", type: "string", desc: "VM size, e.g. Standard_B2s." },
          { flag: "--admin-username", type: "string", desc: "Username for the VM." },
          { flag: "--generate-ssh-keys", type: "boolean", desc: "Generate SSH public and private key files if missing." },
          { flag: "--location", type: "string", desc: "Location, e.g. eastus." },
        ]
      },
      {
        name: "list", desc: "List details of Virtual Machines.", required: [], optional: [
          { flag: "--resource-group", type: "string", desc: "Name of resource group." },
          { flag: "--show-details", type: "boolean", desc: "Show public IP, FQDN and power state." },
        ]
      },
      {
        name: "start", desc: "Start a stopped VM.",
        required: [
          { flag: "--name", type: "string", desc: "Name of the virtual machine." },
          { flag: "--resource-group", type: "string", desc: "Name of resource group." },
        ],
        optional: [{ flag: "--no-wait", type: "boolean", desc: "Do not wait for the long-running operation to finish." }]
      },
      {
        name: "deallocate", desc: "Deallocate a VM so that computing resources are no longer allocated.",
        required: [
          { flag: "--name", type: "string", desc: "Name of the virtual machine." },
          { flag: "--resource-group", type: "string", desc: "Name of resource group." },
        ],
        optional: [{ flag: "--no-wait", type: "boolean", desc: "Do not wait for the long-running operation to finish." }]
      },
    ]
  },
  {
    id: "storage", name: "Storage", commands: [
      {
        name: "account create", desc: "Create a storage account.",
        required: [
          { flag: "--name", type: "string", desc: "The storage account name." },
          { flag: "--resource-group", type: "string", desc: "Name of resource group." },
        ],
        optional: [
          { flag: "--location", type: "string", desc: "Location, e.g. eastus." },
          { flag: "--sku", type: "string", desc: "Standard_LRS | Standard_GRS | Premium_LRS …" },
          { flag: "--kind", type: "string", desc: "StorageV2 | BlobStorage | FileStorage …" },
        ]
      },
      {
        name: "blob upload", desc: "Upload a file to a storage blob.",
        required: [
          { flag: "--container-name", type: "string", desc: "The container name." },
          { flag: "--file", type: "string", desc: "Path of the file to upload." },
        ],
        optional: [
          { flag: "--name", type: "string", desc: "The blob name." },
          { flag: "--account-name", type: "string", desc: "Storage account name." },
          { flag: "--overwrite", type: "boolean", desc: "Whether the blob to be uploaded should overwrite the current data." },
        ]
      },
    ]
  },
  {
    id: "aks", name: "Azure Kubernetes Service", commands: [
      {
        name: "get-credentials", desc: "Get access credentials for a managed Kubernetes cluster.",
        required: [
          { flag: "--name", type: "string", desc: "Name of the managed cluster." },
          { flag: "--resource-group", type: "string", desc: "Name of resource group." },
        ],
        optional: [
          { flag: "--admin", type: "boolean", desc: "Get cluster administrator credentials." },
          { flag: "--overwrite-existing", type: "boolean", desc: "Overwrite any existing cluster entry with the same name." },
        ]
      },
    ]
  },
  {
    id: "keyvault", name: "Key Vault", commands: [
      {
        name: "secret show", desc: "Get a specified secret from a given key vault.",
        required: [{ flag: "--name", type: "string", desc: "Name of the secret." }],
        optional: [
          { flag: "--vault-name", type: "string", desc: "Name of the Key Vault." },
          { flag: "--version", type: "string", desc: "The secret version." },
        ]
      },
    ]
  },
];
