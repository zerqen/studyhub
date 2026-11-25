package ru.studyhub.app.ui.screens

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import ru.studyhub.app.data.AuthSession
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.theme.StudyHubThemeColors
import ru.studyhub.app.widget.DeadlinesWidgetReceiver

@Composable
fun SettingsScreen(
  session: AuthSession,
  snapshot: StudyHubSnapshot,
  onSyncNow: () -> Unit,
  onThemeChange: (String) -> Unit,
  onLogout: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val context = LocalContext.current
  val syncTimeLabel = if (session.lastSyncAt > 0L) {
    Instant.ofEpochMilli(session.lastSyncAt)
      .atZone(ZoneId.systemDefault())
      .format(DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale("ru", "RU")))
  } else {
    "Ещё не синхронизировано"
  }

  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    item {
      Text("Настройки", style = MaterialTheme.typography.headlineLarge, color = colors.fg)
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
            text = "В кеше: ${snapshot.tasks.size} задач, ${snapshot.subjects.size} предметов · Очередь оффлайн-изменений: ${snapshot.pendingOpsCount}",
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

    // Theme selector
    item {
      StudyCard {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("Оформление", style = MaterialTheme.typography.titleLarge, color = colors.fg)
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
