import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime

from workforce_portal.permissions import _employee_for_user, _is_manager


class WorkforceChangeRequest(Document):
	def before_insert(self):
		if not _is_manager():
			employee = _employee_for_user()
			if not employee:
				frappe.throw(_("Текущий пользователь не связан с активным сотрудником"))
			self.employee = employee

	def validate(self):
		entry_employee = frappe.db.get_value(
			"Workforce Schedule Entry", self.schedule_entry, "employee"
		)
		if not _is_manager() and entry_employee != self.employee:
			frappe.throw(_("Нельзя изменить чужую смену"))

		previous = self.get_doc_before_save()
		if previous and previous.status != self.status and self.status in ("Approved", "Rejected"):
			if not _is_manager():
				frappe.throw(_("Решение по запросу может принять только руководитель"))
			self.reviewer = frappe.session.user
			self.reviewed_at = now_datetime()

	def on_update(self):
		if self.status == "Approved" and not self.applied:
			self._apply_change()

	def _apply_change(self):
		entry = frappe.get_doc("Workforce Schedule Entry", self.schedule_entry)
		if self.request_type == "Swap" and self.proposed_employee:
			entry.employee = self.proposed_employee
		if self.request_type == "Move" and self.requested_date:
			entry.work_date = self.requested_date
		if self.proposed_shift_type:
			entry.shift_type = self.proposed_shift_type
		if self.requested_start_time:
			entry.start_time = self.requested_start_time
		if self.requested_end_time:
			entry.end_time = self.requested_end_time
		if self.request_type == "Absence":
			entry.status = "Unassigned"
		entry.source = "Change Request"
		entry.save(ignore_permissions=True)
		self.db_set("applied", 1, update_modified=False)
