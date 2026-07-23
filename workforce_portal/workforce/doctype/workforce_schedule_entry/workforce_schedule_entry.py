import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_first_day, get_last_day, getdate


class WorkforceScheduleEntry(Document):
	def validate(self):
		self._validate_schedule()
		self._validate_date()
		self._validate_duplicate()
		self._set_shift_times()

	def _validate_schedule(self):
		schedule = frappe.get_cached_doc("Workforce Schedule", self.schedule)
		if schedule.status == "Locked" and "System Manager" not in frappe.get_roles():
			frappe.throw(_("Заблокированный график нельзя изменять"))

	def _validate_date(self):
		schedule_month = getdate(frappe.db.get_value("Workforce Schedule", self.schedule, "month_start"))
		work_date = getdate(self.work_date)
		if not get_first_day(schedule_month) <= work_date <= get_last_day(schedule_month):
			frappe.throw(_("Дата смены должна находиться внутри месяца графика"))

	def _validate_duplicate(self):
		filters = {
			"schedule": self.schedule,
			"employee": self.employee,
			"work_date": self.work_date,
			"name": ["!=", self.name or ""],
		}
		if frappe.db.exists("Workforce Schedule Entry", filters):
			frappe.throw(_("Для сотрудника на эту дату уже назначена запись"))

	def _set_shift_times(self):
		if not self.shift_type:
			return
		start_time, end_time = frappe.db.get_value(
			"Shift Type", self.shift_type, ["start_time", "end_time"]
		) or (None, None)
		self.start_time = self.start_time or start_time
		self.end_time = self.end_time or end_time
