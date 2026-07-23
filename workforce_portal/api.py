from calendar import monthrange

import frappe
from frappe import _
from frappe.utils import add_days, get_first_day, get_last_day, getdate, now_datetime

from workforce_portal.permissions import _employee_for_user, _is_manager


EDIT_ROLES = {"System Manager", "HR Manager", "Workforce Manager", "Workforce Supervisor"}
PUBLISH_ROLES = {"System Manager", "HR Manager", "Workforce Manager"}


def _require_roles(allowed: set[str]):
	if not allowed.intersection(frappe.get_roles()):
		frappe.throw(_("Недостаточно прав"), frappe.PermissionError)


def _schedule_filters(month_start, company=None, department=None):
	filters = {"month_start": get_first_day(getdate(month_start))}
	if company:
		filters["company"] = company
	if department:
		filters["department"] = department
	else:
		filters["department"] = ["is", "not set"]
	return filters


@frappe.whitelist()
def get_month_view(month_start, company=None, department=None):
	month_start = get_first_day(getdate(month_start))
	month_end = get_last_day(month_start)

	employee_filters = {"status": "Active"}
	if company:
		employee_filters["company"] = company
	if department:
		employee_filters["department"] = department
	if not _is_manager():
		employee = _employee_for_user()
		if not employee:
			frappe.throw(_("Текущий пользователь не связан с активным сотрудником"))
		employee_filters["name"] = employee

	employees = frappe.get_all(
		"Employee",
		filters=employee_filters,
		fields=["name", "employee_name", "department", "designation", "company"],
		order_by="employee_name asc",
	)
	employee_names = [employee.name for employee in employees]

	schedule_name = frappe.db.get_value(
		"Workforce Schedule", _schedule_filters(month_start, company, department), "name"
	)
	schedule = (
		frappe.get_doc("Workforce Schedule", schedule_name).as_dict()
		if schedule_name
		else None
	)

	entries = []
	if schedule_name and employee_names:
		entries = frappe.get_all(
			"Workforce Schedule Entry",
			filters={
				"schedule": schedule_name,
				"employee": ["in", employee_names],
				"work_date": ["between", [month_start, month_end]],
			},
			fields=[
				"name",
				"employee",
				"work_date",
				"shift_type",
				"start_time",
				"end_time",
				"status",
				"source",
				"note",
			],
			order_by="work_date asc",
		)

	leaves = []
	if employee_names:
		leaves = frappe.get_all(
			"Leave Application",
			filters=[
				["employee", "in", employee_names],
				["docstatus", "=", 1],
				["status", "=", "Approved"],
				["from_date", "<=", month_end],
				["to_date", ">=", month_start],
			],
			fields=[
				"name",
				"employee",
				"leave_type",
				"from_date",
				"to_date",
				"half_day",
				"half_day_date",
			],
		)

	shift_types = frappe.get_all(
		"Shift Type",
		fields=["name", "start_time", "end_time"],
		order_by="name asc",
	)

	days = [
		{
			"date": str(add_days(month_start, offset)),
			"day": offset + 1,
			"weekday": add_days(month_start, offset).strftime("%a"),
		}
		for offset in range(monthrange(month_start.year, month_start.month)[1])
	]

	return {
		"schedule": schedule,
		"employees": employees,
		"days": days,
		"entries": entries,
		"leaves": leaves,
		"shift_types": shift_types,
		"can_edit": bool(EDIT_ROLES.intersection(frappe.get_roles())),
		"can_publish": bool(PUBLISH_ROLES.intersection(frappe.get_roles())),
	}


@frappe.whitelist()
def create_schedule(month_start, company, department=None):
	_require_roles(EDIT_ROLES)
	filters = _schedule_filters(month_start, company, department)
	existing = frappe.db.get_value("Workforce Schedule", filters, "name")
	if existing:
		return frappe.get_doc("Workforce Schedule", existing).as_dict()

	doc = frappe.get_doc(
		{
			"doctype": "Workforce Schedule",
			"company": company,
			"department": department,
			"month_start": filters["month_start"],
			"status": "Draft",
		}
	)
	doc.insert()
	return doc.as_dict()


@frappe.whitelist()
def save_entry(
	schedule,
	employee,
	work_date,
	shift_type=None,
	start_time=None,
	end_time=None,
	status="Shift",
	note=None,
):
	_require_roles(EDIT_ROLES)
	if frappe.db.get_value("Workforce Schedule", schedule, "status") == "Locked":
		frappe.throw(_("График заблокирован"))

	name = frappe.db.get_value(
		"Workforce Schedule Entry",
		{"schedule": schedule, "employee": employee, "work_date": getdate(work_date)},
		"name",
	)
	doc = frappe.get_doc("Workforce Schedule Entry", name) if name else frappe.new_doc("Workforce Schedule Entry")
	doc.update(
		{
			"schedule": schedule,
			"employee": employee,
			"work_date": getdate(work_date),
			"shift_type": shift_type,
			"start_time": start_time,
			"end_time": end_time,
			"status": status,
			"source": "Manual",
			"note": note,
		}
	)
	doc.save()
	return doc.as_dict()


@frappe.whitelist()
def delete_entry(name):
	_require_roles(EDIT_ROLES)
	frappe.delete_doc("Workforce Schedule Entry", name)
	return {"deleted": name}


@frappe.whitelist()
def publish_schedule(schedule, lock=0):
	_require_roles(PUBLISH_ROLES)
	doc = frappe.get_doc("Workforce Schedule", schedule)
	doc.mark_published()
	if frappe.utils.cint(lock):
		doc.status = "Locked"
	doc.save()
	return doc.as_dict()


@frappe.whitelist()
def submit_change_request(
	schedule_entry,
	request_type,
	reason,
	requested_date=None,
	proposed_employee=None,
	proposed_shift_type=None,
	requested_start_time=None,
	requested_end_time=None,
):
	employee = _employee_for_user()
	if not employee and not _is_manager():
		frappe.throw(_("Текущий пользователь не связан с активным сотрудником"))
	entry_employee = frappe.db.get_value("Workforce Schedule Entry", schedule_entry, "employee")
	if not _is_manager() and entry_employee != employee:
		frappe.throw(_("Нельзя изменить чужую смену"))

	doc = frappe.get_doc(
		{
			"doctype": "Workforce Change Request",
			"employee": employee or entry_employee,
			"schedule_entry": schedule_entry,
			"request_type": request_type,
			"reason": reason,
			"requested_date": requested_date,
			"proposed_employee": proposed_employee,
			"proposed_shift_type": proposed_shift_type,
			"requested_start_time": requested_start_time,
			"requested_end_time": requested_end_time,
			"status": "Pending",
		}
	)
	doc.insert()
	return doc.as_dict()


@frappe.whitelist()
def review_change_request(name, decision, comment=None):
	_require_roles(PUBLISH_ROLES)
	if decision not in ("Approved", "Rejected"):
		frappe.throw(_("Недопустимое решение"))
	doc = frappe.get_doc("Workforce Change Request", name)
	doc.status = decision
	doc.review_comment = comment
	doc.reviewer = frappe.session.user
	doc.reviewed_at = now_datetime()
	doc.save()
	return doc.as_dict()
