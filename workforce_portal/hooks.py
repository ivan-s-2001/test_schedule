app_name = "workforce_portal"
app_title = "Workforce Portal"
app_publisher = "Workforce Portal"
app_description = "Employee scheduling and shift change workflows for Frappe HR"
app_email = "dev@localhost"
app_license = "MIT"

required_apps = ["erpnext", "hrms"]

after_install = "workforce_portal.install.after_install"

app_include_css = "/assets/workforce_portal/css/workforce.css"

permission_query_conditions = {
    "Workforce Schedule Entry": "workforce_portal.permissions.get_schedule_entry_query_conditions",
    "Workforce Change Request": "workforce_portal.permissions.get_change_request_query_conditions",
}

has_permission = {
    "Workforce Schedule Entry": "workforce_portal.permissions.has_schedule_entry_permission",
    "Workforce Change Request": "workforce_portal.permissions.has_change_request_permission",
}
