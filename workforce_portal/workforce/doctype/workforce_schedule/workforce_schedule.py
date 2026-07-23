import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_first_day, getdate, now_datetime


class WorkforceSchedule(Document):
	def validate(self):
		self.month_start = get_first_day(getdate(self.month_start))
		self._validate_unique_scope()
		self._validate_locked_state()

	def _validate_unique_scope(self):
		filters = {
			"company": self.company,
			"department": self.department or ["is", "not set"],
			"month_start": self.month_start,
			"name": ["!=", self.name or ""],
		}
		if frappe.db.exists("Workforce Schedule", filters):
			frappe.throw(_("Для выбранного месяца и подразделения график уже существует"))

	def _validate_locked_state(self):
		previous = self.get_doc_before_save()
		if previous and previous.status == "Locked" and self.status == "Locked":
			frappe.throw(_("Заблокированный график нельзя изменять"))

	def mark_published(self):
		self.status = "Published"
		self.published_at = now_datetime()
		self.published_by = frappe.session.user
