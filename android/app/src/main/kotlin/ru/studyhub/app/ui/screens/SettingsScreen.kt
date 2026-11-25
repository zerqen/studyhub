package ru.studyhub.app.ui.screens

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import ru.studyhub.app.data.AuthSession
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.theme.StudyHubThemeColors
import ru.studyhub.app.widget.DeadlinesWidgetReceiver

private val MORNING_SLOTS = listOf(7 to 30, 8 to 0, 8 to 30, 9 to 0)
private val EVENING_SLOTS = listOf(19 to 0, 20 to 0, 21 to 0, 22 to 0)

@Composable
fun SettingsScreen(
  session: AuthSession,
  snapshot: StudyHubSnapshot,
  onBack: () -> Unit,
  onSyncNow: () -> Unit,
  onThemeChange: (String) -> Unit,
  onShowLessonsChange: (Boolean) -> Unit,
  onUpdateNotifications: (
    morningEnabled: Boolean,
    morningHour: Int,
    morningMinute: Int,
    eveningEnabled: Boolean,
    eveningHour: Int,
    eveningMinute: Int,
  ) -> Unit,
  onTestNotification: () -> Unit,
  onLogout: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val context = LocalContext.current
  val syncTimeLabel = if (session.lastSyncAt > 0L) {
    Instant.ofEpochMilli(session.lastSyncAt)
      .atZone(ZoneId.systemDefault())
      .format(DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale.forLanguageTag("ru-RU")))
  } else {
    "Ещё не синхронизировано"
  }

  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission(),
  ) { granted ->
    if (granted) {
      onTestNotification()
    } else {
      Toast.makeText(context, "Разреши уведомления в настройках телефона", Toast.LENGTH_SHORT).show()
    }
  }

  fun requestNotifPermissionIfNeeded(afterGranted: () -> Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val granted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
      ) == PackageManager.PERMISSION_GRANTED
      if (!granted) {
        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        return
      }
    }
    afterGranted()
  }

  LazyColumn(
    modifier = Modifier
      .fillMaxSize()
      .statusBarsPadding()
      .navigationBarsPadding(),
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    item {
      Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) {
          Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Назад", tint = colors.fg)
        }
        Text("Настройки", style = MaterialTheme.typography.headlineLarge, color = colors.fg)
      }
    }

    // Account card
    item {
      StudyCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("Аккаунт", style = MaterialTheme.typography.titleLarge, color = colors.fg)
          Text(session.userName.ifBlank { "Пользователь" }, style = MaterialTheme.typography.titleMedium, color = colors.fg)
          Text(session.userEmail, style = MaterialTheme.typography.bodyMedium, color = colors.muted)
          HorizontalDivider(color = colors.line, modifier = Modifier.padding(vertical = 6.dp))
          Text("Сервер", style = MaterialTheme.typography.labelMedium, color = colors.muted)
          Text(session.serverUrl, style = MaterialTheme.typography.bodyMedium, color = colors.fg)
        }
      }
    }

    // Offline & Sync card
    item {
      StudyCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Оффлайн и синхронизация", style = MaterialTheme.typography.titleLarge, color = colors.fg)
          Text(
            text = "Последняя синхронизация: $syncTimeLabel",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.muted,
          )
          Text(
            text = "В кеше: ${snapshot.tasks.size} задач, ${snapshot.questions.size} карточек, ${snapshot.notes.size} заметок, ${snapshot.lectures.size} лекций · Очередь: ${snapshot.pendingOpsCount}",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.fg,
          )
          if (!snapshot.lastError.isNullOrBlank()) {
            Text(snapshot.lastError, style = MaterialTheme.typography.bodyMedium, color = colors.urgent)
          }
          Button(
            onClick = onSyncNow,
            enabled = !snapshot.isSyncing,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text(
              if (snapshot.isSyncing) "Синхронизация…" else "Синхронизировать сейчас",
              color = Color.White,
            )
          }
        }
      }
    }

    // Local Offline Notifications card
    item {
      StudyCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Уведомления (оффлайн)", style = MaterialTheme.typography.titleLarge, color = colors.fg)
          Text(
            text = "Локальные напоминания о дедлайнах и карточках работают даже без интернета.",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.muted,
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text("Утренняя сводка", style = MaterialTheme.typography.bodyLarge, color = colors.fg)
            Switch(
              checked = session.notifMorningEnabled,
              onCheckedChange = { enabled ->
                if (enabled) requestNotifPermissionIfNeeded {}
                onUpdateNotifications(
                  enabled,
                  session.notifMorningHour,
                  session.notifMorningMinute,
                  session.notifEveningEnabled,
                  session.notifEveningHour,
                  session.notifEveningMinute,
                )
              },
            )
          }
          if (session.notifMorningEnabled) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              items(MORNING_SLOTS) { (h, m) ->
                val selected = session.notifMorningHour == h && session.notifMorningMinute == m
                FilterChip(
                  selected = selected,
                  onClick = {
                    onUpdateNotifications(
                      true,
                      h,
                      m,
                      session.notifEveningEnabled,
                      session.notifEveningHour,
                      session.notifEveningMinute,
                    )
                  },
                  label = { Text(String.format(Locale.US, "%02d:%02d", h, m)) },
                )
              }
            }
          }

          HorizontalDivider(color = colors.line)

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text("Вечернее напоминание", style = MaterialTheme.typography.bodyLarge, color = colors.fg)
            Switch(
              checked = session.notifEveningEnabled,
              onCheckedChange = { enabled ->
                if (enabled) requestNotifPermissionIfNeeded {}
                onUpdateNotifications(
                  session.notifMorningEnabled,
                  session.notifMorningHour,
                  session.notifMorningMinute,
                  enabled,
                  session.notifEveningHour,
                  session.notifEveningMinute,
                )
              },
            )
          }
          if (session.notifEveningEnabled) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              items(EVENING_SLOTS) { (h, m) ->
                val selected = session.notifEveningHour == h && session.notifEveningMinute == m
                FilterChip(
                  selected = selected,
                  onClick = {
                    onUpdateNotifications(
                      session.notifMorningEnabled,
                      session.notifMorningHour,
                      session.notifMorningMinute,
                      true,
                      h,
                      m,
                    )
                  },
                  label = { Text(String.format(Locale.US, "%02d:%02d", h, m)) },
                )
              }
            }
          }

          OutlinedButton(
            onClick = { requestNotifPermissionIfNeeded(onTestNotification) },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text("Проверить уведомление")
          }
        }
      }
    }

    // Widget card
    item {
      StudyCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Виджет на рабочий стол", style = MaterialTheme.typography.titleLarge, color = colors.fg)
          Text(
            text = "Показывает ближайшие дедлайны и позволяет отмечать задачи выполненными прямо с главного экрана — даже без интернета.",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.muted,
          )
          OutlinedButton(
            onClick = {
              val manager = AppWidgetManager.getInstance(context)
              val provider = ComponentName(context, DeadlinesWidgetReceiver::class.java)
              if (manager.isRequestPinAppWidgetSupported) {
                manager.requestPinAppWidget(provider, null, null)
              } else {
                Toast.makeText(
                  context,
                  "Удерживай пустое место на рабочем столе → Виджеты → StudyHub",
                  Toast.LENGTH_LONG,
                ).show()
              }
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text("Добавить виджет «Дедлайны»")
          }
        }
      }
    }

    // Theme & Calendar selector
    item {
      StudyCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Оформление и расписание", style = MaterialTheme.typography.titleLarge, color = colors.fg)
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
              selected = session.themeMode == "system",
              onClick = { onThemeChange("system") },
              label = { Text("Системная") },
            )
            FilterChip(
              selected = session.themeMode == "light",
              onClick = { onThemeChange("light") },
              label = { Text("Чернила") },
            )
            FilterChip(
              selected = session.themeMode == "dark",
              onClick = { onThemeChange("dark") },
              label = { Text("Тёмная") },
            )
          }
          HorizontalDivider(color = colors.line)
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Column(modifier = Modifier.weight(1f)) {
              Text("Показывать пары", style = MaterialTheme.typography.bodyLarge, color = colors.fg)
              Text(
                text = "По умолчанию пары скрыты на главной и в календаре",
                style = MaterialTheme.typography.labelMedium,
                color = colors.muted,
              )
            }
            Switch(
              checked = session.showLessons,
              onCheckedChange = onShowLessonsChange,
            )
          }
        }
      }
    }

    // Logout
    item {
      OutlinedButton(
        onClick = onLogout,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("Выйти из аккаунта", color = colors.danger)
      }
    }

    item { Spacer(modifier = Modifier.height(64.dp)) }
  }
}
