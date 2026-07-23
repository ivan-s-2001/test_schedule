frappe.pages["workforce-schedule"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("График работы"),
		single_column: true,
	});

	new WorkforceSchedulePage(page);
};

class WorkforceSchedulePage {
	constructor(page) {
		this.page = page;
		this.$body = $("<div class='workforce-page'></div>").appendTo(page.body);
		this.setupFilters();
		this.refresh();
	}

	setupFilters() {
		this.companyField = this.page.add_field({
			label: __("Компания"),
			fieldtype: "Link",
			fieldname: "company",
			options: "Company",
			default: frappe.defaults.get_default("Company"),
			change: () => this.refresh(),
		});
		this.departmentField = this.page.add_field({
			label: __("Подразделение"),
			fieldtype: "Link",
			fieldname: "department",
			options: "Department",
			change: () => this.refresh(),
		});
		this.monthField = this.page.add_field({
			label: __("Месяц"),
			fieldtype: "Date",
			fieldname: "month_start",
			default: frappe.datetime.month_start(),
			change: () => this.refresh(),
		});
		this.page.set_secondary_action(__("Обновить"), () => this.refresh(), "refresh");
	}

	async refresh() {
		const monthStart = this.monthField.get_value();
		if (!monthStart) return;

		const response = await frappe.call({
			method: "workforce_portal.api.get_month_view",
			args: {
				month_start: monthStart,
				company: this.companyField.get_value(),
				department: this.departmentField.get_value(),
			},
			freeze: true,
			freeze_message: __("Загружаем график"),
		});

		this.data = response.message;
		this.render();
		this.setupActions();
	}

	setupActions() {
		this.page.clear_primary_action();
		this.page.clear_inner_toolbar();

		if (!this.data.schedule && this.data.can_edit) {
			this.page.set_primary_action(__("Создать график"), () => this.createSchedule());
			return;
		}

		if (this.data.schedule && this.data.can_publish && this.data.schedule.status === "Draft") {
			this.page.set_primary_action(__("Опубликовать"), () => this.publishSchedule(false));
			this.page.add_inner_button(__("Опубликовать и заблокировать"), () => this.publishSchedule(true));
		}

		if (this.data.schedule) {
			this.page.add_inner_button(__("Открыть карточку графика"), () => {
				frappe.set_route("Form", "Workforce Schedule", this.data.schedule.name);
			});
		}
	}

	async createSchedule() {
		if (!this.companyField.get_value()) {
			frappe.msgprint(__("Выберите компанию"));
			return;
		}
		await frappe.call({
			method: "workforce_portal.api.create_schedule",
			args: {
				month_start: this.monthField.get_value(),
				company: this.companyField.get_value(),
				department: this.departmentField.get_value(),
			},
			freeze: true,
		});
		await this.refresh();
	}

	publishSchedule(lock) {
		frappe.confirm(
			lock
				? __("Опубликовать и запретить дальнейшее редактирование графика?")
				: __("Опубликовать график для сотрудников?"),
			async () => {
				await frappe.call({
					method: "workforce_portal.api.publish_schedule",
					args: { schedule: this.data.schedule.name, lock: lock ? 1 : 0 },
					freeze: true,
				});
				await this.refresh();
			}
		);
	}

	render() {
		if (!this.data.employees.length) {
			this.$body.html(`<div class="workforce-empty">${__("Сотрудники не найдены")}</div>`);
			return;
		}

		const entryMap = new Map(
			this.data.entries.map((entry) => [`${entry.employee}:${entry.work_date}`, entry])
		);
		const leaveMap = this.buildLeaveMap(this.data.leaves);
		const scheduleStatus = this.data.schedule?.status || __("График не создан");
		const statusClass = (this.data.schedule?.status || "missing").toLowerCase();

		const header = this.data.days
			.map((day) => {
				const weekend = ["Sat", "Sun"].includes(day.weekday) ? " is-weekend" : "";
				return `<th class="workforce-day${weekend}"><span>${day.day}</span><small>${day.weekday}</small></th>`;
			})
			.join("");

		const rows = this.data.employees
			.map((employee) => {
				const cells = this.data.days
					.map((day) => {
						const key = `${employee.name}:${day.date}`;
						const entry = entryMap.get(key);
						const leave = leaveMap.get(key);
						return this.renderCell(employee, day, entry, leave);
					})
					.join("");
				return `<tr>
					<th class="workforce-employee">
						<strong>${frappe.utils.escape_html(employee.employee_name || employee.name)}</strong>
						<span>${frappe.utils.escape_html(employee.designation || employee.department || "")}</span>
					</th>
					${cells}
				</tr>`;
			})
			.join("");

		this.$body.html(`
			<div class="workforce-summary">
				<div>
					<strong>${__("Месячный график")}</strong>
					<span>${frappe.datetime.str_to_user(this.monthField.get_value())}</span>
				</div>
				<span class="workforce-status is-${statusClass}">${frappe.utils.escape_html(scheduleStatus)}</span>
			</div>
			<div class="workforce-grid-wrap">
				<table class="workforce-grid">
					<thead><tr><th class="workforce-employee">${__("Сотрудник")}</th>${header}</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
			<div class="workforce-legend">
				<span><i class="is-shift"></i>${__("Смена")}</span>
				<span><i class="is-day-off"></i>${__("Выходной")}</span>
				<span><i class="is-leave"></i>${__("Отпуск")}</span>
				<span><i class="is-unassigned"></i>${__("Не назначено")}</span>
			</div>
		`);

		this.bindCells();
	}

	renderCell(employee, day, entry, leave) {
		const weekend = ["Sat", "Sun"].includes(day.weekday) ? " is-weekend" : "";
		if (leave) {
			return `<td class="workforce-cell is-leave${weekend}" title="${frappe.utils.escape_html(leave.leave_type)}">
				<span>${frappe.utils.escape_html(leave.leave_type)}</span>
			</td>`;
		}

		const status = entry?.status || "Unassigned";
		const cssStatus = status.toLowerCase().replaceAll(" ", "-");
		let label = entry?.shift_type || "—";
		if (status === "Day Off") label = __("В");
		if (entry && !entry.shift_type && entry.start_time) {
			label = `${this.shortTime(entry.start_time)}–${this.shortTime(entry.end_time)}`;
		}

		return `<td class="workforce-cell is-${cssStatus}${weekend}"
			data-employee="${employee.name}"
			data-date="${day.date}"
			data-entry="${entry?.name || ""}">
			<span>${frappe.utils.escape_html(label)}</span>
			${entry?.start_time ? `<small>${this.shortTime(entry.start_time)}–${this.shortTime(entry.end_time)}</small>` : ""}
		</td>`;
	}

	bindCells() {
		this.$body.off("click", ".workforce-cell[data-employee]");
		this.$body.on("click", ".workforce-cell[data-employee]", (event) => {
			const $cell = $(event.currentTarget);
			const entry = this.data.entries.find((item) => item.name === $cell.data("entry"));
			if (this.data.can_edit && this.data.schedule?.status !== "Locked") {
				this.openEntryDialog($cell.data("employee"), $cell.data("date"), entry);
			} else if (entry) {
				this.openRequestDialog(entry);
			}
		});
	}

	openEntryDialog(employee, workDate, entry) {
		if (!this.data.schedule) {
			frappe.msgprint(__("Сначала создайте график"));
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: entry ? __("Изменить смену") : __("Назначить смену"),
			fields: [
				{ fieldname: "shift_type", fieldtype: "Link", options: "Shift Type", label: __("Тип смены"), default: entry?.shift_type },
				{ fieldname: "status", fieldtype: "Select", label: __("Состояние"), options: "Shift\nDay Off\nTraining\nBusiness Trip\nUnassigned", default: entry?.status || "Shift", reqd: 1 },
				{ fieldname: "start_time", fieldtype: "Time", label: __("Начало"), default: entry?.start_time },
				{ fieldname: "end_time", fieldtype: "Time", label: __("Окончание"), default: entry?.end_time },
				{ fieldname: "note", fieldtype: "Small Text", label: __("Комментарий"), default: entry?.note },
			],
			primary_action_label: __("Сохранить"),
			primary_action: async (values) => {
				await frappe.call({
					method: "workforce_portal.api.save_entry",
					args: {
						schedule: this.data.schedule.name,
						employee,
						work_date: workDate,
						...values,
					},
					freeze: true,
				});
				dialog.hide();
				await this.refresh();
			},
		});

		if (entry) {
			dialog.set_secondary_action(__("Удалить"), async () => {
				await frappe.call({ method: "workforce_portal.api.delete_entry", args: { name: entry.name } });
				dialog.hide();
				await this.refresh();
			});
		}
		dialog.show();
	}

	openRequestDialog(entry) {
		const dialog = new frappe.ui.Dialog({
			title: __("Запросить изменение смены"),
			fields: [
				{ fieldname: "request_type", fieldtype: "Select", label: __("Тип запроса"), options: "Swap\nMove\nDelay\nOvertime\nAbsence", reqd: 1 },
				{ fieldname: "requested_date", fieldtype: "Date", label: __("Новая дата") },
				{ fieldname: "proposed_employee", fieldtype: "Link", options: "Employee", label: __("Сотрудник на замену") },
				{ fieldname: "proposed_shift_type", fieldtype: "Link", options: "Shift Type", label: __("Новый тип смены") },
				{ fieldname: "requested_start_time", fieldtype: "Time", label: __("Новое начало") },
				{ fieldname: "requested_end_time", fieldtype: "Time", label: __("Новое окончание") },
				{ fieldname: "reason", fieldtype: "Small Text", label: __("Причина"), reqd: 1 },
			],
			primary_action_label: __("Отправить"),
			primary_action: async (values) => {
				await frappe.call({
					method: "workforce_portal.api.submit_change_request",
					args: { schedule_entry: entry.name, ...values },
					freeze: true,
				});
				dialog.hide();
				frappe.show_alert({ message: __("Запрос отправлен"), indicator: "green" });
			},
		});
		dialog.show();
	}

	buildLeaveMap(leaves) {
		const result = new Map();
		for (const leave of leaves) {
			const current = frappe.datetime.str_to_obj(leave.from_date);
			const end = frappe.datetime.str_to_obj(leave.to_date);
			while (current <= end) {
				const date = frappe.datetime.obj_to_str(current);
				result.set(`${leave.employee}:${date}`, leave);
				current.setDate(current.getDate() + 1);
			}
		}
		return result;
	}

	shortTime(value) {
		return value ? String(value).slice(0, 5) : "";
	}
}
