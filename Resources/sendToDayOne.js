var _ = (function() {
	var action = new PlugIn.Action(function(selection, sender) {
		// CONFIGURATION
		config = this.completedReportConfig;
		tagsToExclude = config.tagsToExclude();
		dayOneJournalName = config.dayOneJournalName();

		functionLibrary = PlugIn.find("com.KaitlinSalzke.functionLibrary").library(
			"functionLibrary"
		);

		var now = new Date();
		var today = Calendar.current.startOfDay(now);
		var yesterday = functionLibrary.removeOneDayFromDate(today);

		// basic selection form - select today, tomorrow, or other
		var selectDayForm = new Form();
		selectDayPopupMenu = new Form.Field.Option(
			"selectedDay",
			"Day",
			["Today", "Yesterday", "Other"],
			null,
			"Today"
		);
		selectDayForm.addField(selectDayPopupMenu);
		selectDayFormPrompt = "Which day?";
		selectDayFormPromise = selectDayForm.show(selectDayFormPrompt, "Continue");

		// form for when 'other' is selected - to enter alternative date
		var selectOtherDateForm = new Form();
		selectOtherDateDateField = new Form.Field.Date("dateInput", "Date", today);
		selectOtherDateForm.addField(selectOtherDateDateField);
		selectOtherDateFormPrompt = "Select date:";

		// show forms
		selectDayFormPromise.then(function(formObject) {
			optionSelected = formObject.values["selectedDay"];
			console.log(optionSelected);
			console.log(today);
			switch (optionSelected) {
				case "Today":
					runReportForDay(today);
					break;
				case "Yesterday":
					runReportForDay(yesterday);
					break;
				case "Other":
					selectOtherDateFormPromise = selectOtherDateForm.show(
						selectOtherDateFormPrompt,
						"Continue"
					);
					selectOtherDateFormPromise.then(function(formObject) {
						runReportForDay(formObject.values["dateInput"]);
					});
					selectOtherDateFormPromise.catch(function(err) {
						console.log("form cancelled", err.message);
					});
					break;
				default:
			}
		});

		selectDayFormPromise.catch(function(err) {
			console.log("form cancelled", err.message);
		});
	});

	action.validate = function(selection, sender) {
		return true;
	};

	return action;
})();
_;

function isHidden(element) {
	return tagsToExclude.includes(element);
}

function getTasksCompletedOnDate(date) {
	var tasksCompletedToday = new Array();

	function completedToday(item) {
		if (
			item.completed &&
			Calendar.current.startOfDay(item.completionDate).getTime() ==
				date.getTime() &&
			!item.tags.some(isHidden)
		) {
			return true;
		} else return false;
	}

	// get completed tasks from inbox
	inbox.apply(item => {
		if (completedToday(item)) {
			tasksCompletedToday.push(item);
			return ApplyResult.SkipChildren;
		}
	});

	// get other tasks (the top-most completed)
	library.apply(function(item) {
		if (item instanceof Project && item.task.hasChildren) {
			item.task.apply(tsk => {
				if (completedToday(tsk)) {
					tasksCompletedToday.push(tsk);
					return ApplyResult.SkipChildren;
				}
			});
		}
	});
	return tasksCompletedToday;
}

function runReportForDay(date) {
	// generate TaskPaper and send to Day One
	tasksCompletedToday = getTasksCompletedOnDate(date);
	markdown = "# Tasks Completed on " + date.toDateString() + "\n";
	currentFolder = "No Folder";
	tasksCompletedToday.forEach(function(completedTask) {
		containingFolder = functionLibrary.getContainingFolder(completedTask).name;
		if (currentFolder !== containingFolder) {
			markdown = markdown.concat("\n**", containingFolder, "** \n");
			currentFolder = containingFolder;
		}
		markdown = markdown.concat(" * ", completedTask.name, "\n");
	});

	var dayOneUrlStr =
		"dayone://post?entry=" +
		encodeURIComponent(markdown) +
		"&journal=" +
		encodeURIComponent(dayOneJournalName);

	URL.fromString(dayOneUrlStr).call(() => {});
}
