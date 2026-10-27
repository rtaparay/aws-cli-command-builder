// Cloud registry: everything that changes between AWS and Azure lives here.
// To use official logos, drop the SVG files in assets/logos/ and set `logo` (e.g. "assets/logos/aws.svg").
const CLOUDS = {
  aws: {
    id: "aws",
    short: "AWS",
    name: "Amazon Web Services",
    cli: "aws",
    cliName: "AWS CLI v2",
    catalogUrl: "catalog.json",
    source: "botocore",
    sourceSub: "service models (Apache-2.0)",
    mark: "AWS",
    logo: null,
    searchHint: "list S3 buckets",
  },
  azure: {
    id: "azure",
    short: "Azure",
    name: "Microsoft Azure",
    cli: "az",
    cliName: "Azure CLI",
    catalogUrl: "azure-catalog.json",
    source: "azure-cli",
    sourceSub: "command modules (MIT)",
    mark: "Az",
    logo: null,
    searchHint: "create a resource group in eastus",
  },
  // Upcoming modules: shown in the menu and home cards with a "Próximamente" message, no catalog yet.
  oci: {
    id: "oci",
    short: "OCI",
    name: "Oracle Cloud Infrastructure",
    cli: "oci",
    cliName: "OCI CLI",
    mark: "OCI",
    logo: null,
    soon: true,
  },
  gcp: {
    id: "gcp",
    short: "GCP",
    name: "Google Cloud Platform",
    cli: "gcloud",
    cliName: "Google Cloud CLI",
    mark: "GCP",
    logo: null,
    soon: true,
  },
};

const CLOUD_IDS = Object.keys(CLOUDS).filter(id => !CLOUDS[id].soon); // clouds with a catalog
const SOON_CLOUD_IDS = Object.keys(CLOUDS).filter(id => CLOUDS[id].soon); // coming soon

const SOON_MESSAGE = "Próximamente se va a agregar";

// Click on an upcoming cloud: shows the message on the card/row that was clicked and as a toast.
function showComingSoon(cloudId, el) {
  notify(CLOUDS[cloudId].name + ": próximamente se va a agregar");
  if (!el) return;
  el.classList.remove("soon-open");
  void el.offsetWidth; // restart the animation on repeated clicks
  el.classList.add("soon-open");
  clearTimeout(el._soonTimer);
  el._soonTimer = setTimeout(() => el.classList.remove("soon-open"), 3200);
}

// Logo badge for a cloud. Uses the image if one is configured and loads; otherwise a text mark.
function cloudMark(cloudId, size) {
  const c = CLOUDS[cloudId];
  const el = h("span", { class: "cloud-mark " + cloudId + (size ? " " + size : ""), "aria-hidden": "true" }, c.mark);
  if (c.logo) {
    const img = h("img", { src: c.logo, alt: "" });
    img.addEventListener("error", () => img.remove());
    img.addEventListener("load", () => el.classList.add("has-img"));
    el.append(img);
  }
  return el;
}
