package ru.studyhub.app.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.time.Duration
import java.time.LocalDate
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit
import ru.studyhub.app.MainActivity
import ru.studyhub.app.StudyHubApplication
import ru.studyhub.app.data.AuthSession
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.SrsEngine
import ru.studyhub.app.data.StudyHubSnapshot

data class DigestContent(
  val title: String,
  val body: String,
)

object DigestBuilder {
  private fun plural(n: Int, one: String, few: String, many: String): String {
    val m10 = n % 10
    val m100 = n % 100
    return when {
      m10 == 1 && m100 != 11 -> "$n $one"
      m10 in 2..4 && m100 !in 12..14 -> "$n $few"
      else -> "$n $many"
    }
  }

  fun buildMorning(
    snapshot: StudyHubSnapshot,
    showLessons: Boolean,
    today: LocalDate = DateHelpers.today(),
  ): DigestContent? {
    val openTasks = snapshot.tasks.filter { it.status != "DONE" && it.status != "CANCELLED" }
    val overdue = openTasks.filter { DateHelpers.isOverdue(it, today) }
    val todayTasks = openTasks.filter { DateHelpers.parseDateOnly(it.dueDate) == today }
    val dueCards = snapshot.questions.count { it.srsReps > 0 && SrsEngine.isDue(it.srsDue) }
    val upcomingExams = snapshot.subjects.filter { sub ->
      val d = DateHelpers.daysUntil(sub.examDate, today)
      d != null && d in 0L..3L
    }

    val lines = mutableListOf<String>()

    if (showLessons && snapshot.todayEvents.isNotEmpty()) {
      val first = snapshot.todayEvents.first()
      val timeStr = if (first.allDay) "весь день" else DateHelpers.formatEventTime(first.start)
      lines += "Первая пара: $timeStr ${first.title}"
    }

    if (overdue.isNotEmpty()) {
      lines += "Просрочено: ${plural(overdue.size, "дело", "дела", "дел")}"
    }

    val hwCount = todayTasks.count { it.kind == "HOMEWORK" }
    val otherCount = todayTasks.size - hwCount
    val todayParts = mutableListOf<String>()
    if (hwCount > 0) todayParts += "сдать ${plural(hwCount, "домашку", "домашки", "домашек")}"
    if (otherCount > 0) todayParts += plural(otherCount, "задача", "задачи", "задач")
    if (dueCards > 0) todayParts += "${plural(dueCards, "карточка", "карточки", "карточек")} к повтору"
    if (todayParts.isNotEmpty()) lines += todayParts.joinToString(" · ")

    for (exam in upcomingExams) {
      val days = DateHelpers.daysUntil(exam.examDate, today) ?: continue
      lines += if (days == 0L) {
        "Сегодня экзамен: ${exam.name}. Удачи!"
      } else {
        "Через ${plural(days.toInt(), "день", "дня", "дней")} экзамен: ${exam.name}"
      }
    }

    if (lines.isEmpty()) return null
    val title = when {
      overdue.isNotEmpty() -> "Дедлайны и планы на день"
      todayTasks.isNotEmpty() -> "Задачи на сегодня"
      else -> "Доброе утро · StudyHub"
    }
    return DigestContent(title = title, body = lines.joinToString("\n"))
  }

  fun buildEvening(
    snapshot: StudyHubSnapshot,
    showLessons: Boolean,
    today: LocalDate = DateHelpers.today(),
  ): DigestContent? {
    val tomorrow = today.plusDays(1)
    val openTasks = snapshot.tasks.filter { it.status != "DONE" && it.status != "CANCELLED" }
    val overdueCount = openTasks.count { DateHelpers.isOverdue(it, today) }
    val tomorrowTasks = openTasks.filter { DateHelpers.parseDateOnly(it.dueDate) == tomorrow }
    val dueCards = snapshot.questions.count { it.srsReps > 0 && SrsEngine.isDue(it.srsDue) }
    val tomorrowExam = snapshot.subjects.firstOrNull { DateHelpers.parseDateOnly(it.examDate) == tomorrow }

    val lines = mutableListOf<String>()
    if (tomorrowExam != null) {
      lines += "Завтра экзамен: ${tomorrowExam.name}"
    }

    val hw = tomorrowTasks.filter { it.kind == "HOMEWORK" }
    val subjectsById = snapshot.subjects.associateBy { it.id }
    for (t in hw.take(3)) {
      val subName = t.subjectId?.let { subjectsById[it]?.name }
      lines += if (subName != null) "ДЗ · $subName: ${t.title}" else "ДЗ: ${t.title}"
    }
    if (hw.size > 3) {
      lines += "и ещё ${plural(hw.size - 3, "домашка", "домашки", "домашек")}"
    }

    val otherTomorrow = tomorrowTasks.size - hw.size
    if (otherTomorrow > 0) {
      lines += "${plural(otherTomorrow, "задача", "задачи", "задач")} на завтра"
    }
    if (overdueCount > 0) {
      lines += "Висит просроченных: $overdueCount"
    }
    if (dueCards > 0) {
      lines += "${plural(dueCards, "карточка ждёт", "карточки ждут", "карточек ждут")} повторения"
    }
    if (showLessons && snapshot.calendarEvents.isNotEmpty()) {
      val hasLessonTomorrow = snapshot.calendarEvents.any { ev ->
        SrsEngine.isLessonKind(ev.kind) && ev.start.startsWith(tomorrow.toString())
      }
      if (hasLessonTomorrow && lines.isEmpty()) {
        lines += "Завтра есть пары по расписанию"
      }
    }

    if (lines.isEmpty()) return null
    val title = when {
      tomorrowExam != null -> "Завтра экзамен"
      hw.isNotEmpty() -> "На завтра ${plural(hw.size, "домашка", "домашки", "домашек")}"
      else -> "Вечернее напоминание"
    }
    return DigestContent(title = title, body = lines.joinToString("\n"))
  }

  fun buildTest(
    snapshot: StudyHubSnapshot,
    showLessons: Boolean,
    today: LocalDate = DateHelpers.today(),
  ): DigestContent {
    val morning = buildMorning(snapshot, showLessons, today)
    return if (morning != null) {
      DigestContent(title = "Проверка · ${morning.title}", body = morning.body)
    } else {
      DigestContent(
        title = "StudyHub",
        body = "Локальные уведомления работают! Утренние и вечерние сводки будут приходить даже без интернета.",
      )
    }
  }

  fun delayUntilNextMillis(
    hour: Int,
    minute: Int,
    now: ZonedDateTime = ZonedDateTime.now(),
  ): Long {
    var next = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
    if (!next.isAfter(now.plusSeconds(60))) {
      next = next.plusDays(1)
    }
    return Duration.between(now, next).toMillis().coerceAtLeast(60_000L)
  }
}

object DigestNotifier {
  const val CHANNEL_ID = "studyhub_digests"
  const val MORNING_ID = 1001
  const val EVENING_ID = 1002
  const val TEST_ID = 1003

  fun ensureChannel(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Сводки и дедлайны",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Утренние сводки, вечерние напоминания о домашке и карточках"
    }
    manager.createNotificationChannel(channel)
  }

  fun show(context: Context, notificationId: Int, content: DigestContent) {
    ensureChannel(context)
    val nm = NotificationManagerCompat.from(context)
    if (!nm.areNotificationsEnabled()) return

    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      context,
      notificationId,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentTitle(content.title)
      .setContentText(content.body.lineSequence().firstOrNull().orEmpty())
      .setStyle(NotificationCompat.BigTextStyle().bigText(content.body))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .build()

    try {
      nm.notify(notificationId, notification)
    } catch (_: SecurityException) {
      // Android 13+ POST_NOTIFICATIONS permission not granted
    }
  }
}

class DigestWorker(
  appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val slot = inputData.getString(KEY_SLOT) ?: return Result.success()
    val app = applicationContext as? StudyHubApplication ?: return Result.success()
    val session = app.sessionStore.current()
    if (!session.isLoggedIn) return Result.success()

    val snapshot = app.database.readSnapshot()
    if (slot == SLOT_MORNING && session.notifMorningEnabled) {
      DigestBuilder.buildMorning(snapshot, session.showLessons)?.let {
        DigestNotifier.show(applicationContext, DigestNotifier.MORNING_ID, it)
      }
      DigestScheduler.scheduleSlot(
        applicationContext,
        SLOT_MORNING,
        session.notifMorningHour,
        session.notifMorningMinute,
      )
    } else if (slot == SLOT_EVENING && session.notifEveningEnabled) {
      DigestBuilder.buildEvening(snapshot, session.showLessons)?.let {
        DigestNotifier.show(applicationContext, DigestNotifier.EVENING_ID, it)
      }
      DigestScheduler.scheduleSlot(
        applicationContext,
        SLOT_EVENING,
        session.notifEveningHour,
        session.notifEveningMinute,
      )
    }

    return Result.success()
  }

  companion object {
    const val KEY_SLOT = "slot"
    const val SLOT_MORNING = "morning"
    const val SLOT_EVENING = "evening"
  }
}

object DigestScheduler {
  private const val WORK_MORNING = "studyhub_digest_morning"
  private const val WORK_EVENING = "studyhub_digest_evening"

  fun rescheduleAll(context: Context, session: AuthSession) {
    DigestNotifier.ensureChannel(context)
    val wm = WorkManager.getInstance(context)
    if (!session.isLoggedIn) {
      wm.cancelUniqueWork(WORK_MORNING)
      wm.cancelUniqueWork(WORK_EVENING)
      return
    }
    if (session.notifMorningEnabled) {
      scheduleSlot(context, DigestWorker.SLOT_MORNING, session.notifMorningHour, session.notifMorningMinute)
    } else {
      wm.cancelUniqueWork(WORK_MORNING)
    }
    if (session.notifEveningEnabled) {
      scheduleSlot(context, DigestWorker.SLOT_EVENING, session.notifEveningHour, session.notifEveningMinute)
    } else {
      wm.cancelUniqueWork(WORK_EVENING)
    }
  }

  fun scheduleSlot(context: Context, slot: String, hour: Int, minute: Int) {
    val workName = if (slot == DigestWorker.SLOT_MORNING) WORK_MORNING else WORK_EVENING
    val delayMs = DigestBuilder.delayUntilNextMillis(hour, minute)
    val data = Data.Builder().putString(DigestWorker.KEY_SLOT, slot).build()
    val request = OneTimeWorkRequestBuilder<DigestWorker>()
      .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
      .setInputData(data)
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork(
      workName,
      ExistingWorkPolicy.REPLACE,
      request,
    )
  }
}
