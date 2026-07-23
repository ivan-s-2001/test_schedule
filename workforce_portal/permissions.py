import frappe


MANAGER_ROLES = {"System Manager", "HR Manager", "Workforce Manager", "Workforce Supervisor"}


def _is_manager(user: str | None = None) -> bool:
	user = user or frappe.session.user
	return bool(MANAGER_ROLES.intersection(frappe.get_roles(user)))


def _employee_for_user(user: str | None = None) -> str | None:
	user = user or frappe.session.user
	if user == "Administrator":
		return None
	return frappe.db.get_value("Employee", {"user_id": user, "status": "Active"}, "name")


def get_schedule_entry_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if _is_manager(user):
		return ""
	employee = _employee_for_user(user)
	if not employee:
		return "1=0"
	return f"`tabWorkforce Schedule Entry`.`employee` = {frappe.db.escape(employee)}"


def has_schedule_entry_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	user = user or frappe.session.user
	if _is_manager(user):
		return True
	if permission_type not in (None, "read", "select"):
		return False
	return bool(doc.employee and doc.employee == _employee_for_user(user))


def get_change_request_query_conditions(user: str | None = None) -> str:
	user = user or frappe.session.user
	if _is_manager(user):
		return ""
	employee = _employee_for_user(user)
	if not employee:
		return "1=0"
	return f"`tabWorkforce Change Request`.`employee` = {frappe.db.escape(employee)}"


def has_change_request_permission(doc, user: str | None = None, permission_type: str | None = None) -> bool:
	user = user or frappe.session.user
	if _is_manager(user):
		return True
	employee = _employee_for_user(user)
	if not employee or doc.employee != employee:
		return False
	return permission_type in (None, "read", "select", "create", "write") and doc.status == "Pending"
