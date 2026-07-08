output "watsonx_studio_id" {
  description = "Watson Studio resource instance ID"
  value       = ibm_resource_instance.watsonx_studio.id
}

output "cos_instance_id" {
  description = "Cloud Object Storage instance ID"
  value       = ibm_resource_instance.cos_instance.id
}

output "cos_instance_crn" {
  description = "Cloud Object Storage CRN"
  value       = ibm_resource_instance.cos_instance.crn
}
