import frappe


ROLES = ("Workforce Manager", "Workforce Supervisor")


def after_install():
	for role_name in ROLES:
		if not frappe.db.exists("Role", role_name):
			role = frappe.new_doc("Role")
			role.role_name = role_name
			role.desk_access = 1
			role.insert(ignore_permissions=True)

	frappe.clear_cache()
