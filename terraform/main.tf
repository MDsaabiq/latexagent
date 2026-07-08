terraform {
  required_providers {
    ibm = {
      source  = "IBM-Cloud/ibm"
      version = ">= 1.53.0"
    }
  }
}

provider "ibm" {
  ibmcloud_api_key = var.ibmcloud_api_key
  region           = "eu-de"
}

# Fetch the default resource group on the Lite account
data "ibm_resource_group" "default_group" {
  is_default = true
}

# 1. Provision watsonx.ai Studio (Lite Plan)
resource "ibm_resource_instance" "watsonx_studio" {
  name              = "latex-diagram-generator-studio"
  service           = "data-science-experience"
  plan              = "lite"
  location          = "eu-de"
  resource_group_id = data.ibm_resource_group.default_group.id
}

# 2. Provision Cloud Object Storage (Lite Plan) — hosts static assets
resource "ibm_resource_instance" "cos_instance" {
  name              = "latex-diagram-generator-cos"
  service           = "cloud-object-storage"
  plan              = "lite"
  location          = "global"
  resource_group_id = data.ibm_resource_group.default_group.id
}
