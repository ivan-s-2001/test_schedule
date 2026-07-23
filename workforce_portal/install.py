import frappe


ROLES = ("Workforce Manager", "Workforce Supervisor")
PAGE_ROLES = ("System Manager", "HR Manager", "HR User", "Employee", *ROLES)


def after_install():
	for role_name in ROLES:
		if not frappe.db.exists("Role", role_name):
			role = frappe.new_doc("Role")
			role.role_name = role_name
			role.desk_access = 1
			role.insert(ignore_permissions=True)

	if frappe.db.exists("Page", "workforce-schedule"):
		page = frappe.get_doc("Page", "workforce-schedule")
		existing = {row.role for row in page.roles}
		for role_name in PAGE_ROLES:
			if role_name not in existing:
				page.append("roles", {"role": role_name})
		page.save(ignore_permissions=True)

	frappe.clear_cache()
