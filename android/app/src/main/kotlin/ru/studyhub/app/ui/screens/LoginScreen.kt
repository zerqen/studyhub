package ru.studyhub.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.theme.StudyHubThemeColors

@Composable
fun LoginScreen(
  initialServerUrl: String,
  isLoading: Boolean,
  error: String?,
  onLogin: (serverUrl: String, email: String, password: String) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  var serverUrl by rememberSaveable { mutableStateOf(initialServerUrl.ifBlank { "https://" }) }
  var email by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  var showPassword by rememberSaveable { mutableStateOf(false) }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .imePadding()
      .padding(horizontal = 20.dp, vertical = 40.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(
      text = "StudyHub",
      style = MaterialTheme.typography.headlineLarge,
      color = colors.fg,
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Задачи, домашка и дедлайны — всегда под рукой, даже оффлайн",
      style = MaterialTheme.typography.bodyMedium,
      color = colors.muted,
    )

    Spacer(modifier = Modifier.height(28.dp))

    StudyCard {
      Column(
        modifier = Modifier.padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
      ) {
        OutlinedTextField(
          value = serverUrl,
          onValueChange = { serverUrl = it },
          label = { Text("Адрес твоего StudyHub") },
          placeholder = { Text("https://studyhub.vercel.app") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
          keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Uri,
            imeAction = ImeAction.Next,
          ),
        )

        OutlinedTextField(
          value = email,
          onValueChange = { email = it },
          label = { Text("Email") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
          keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Next,
          ),
        )

        OutlinedTextField(
          value = password,
          onValueChange = { password = it },
          label = { Text("Пароль") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
          visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Done,
          ),
          trailingIcon = {
            IconButton(onClick = { showPassword = !showPassword }) {
              Icon(
                imageVector = if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                contentDescription = if (showPassword) "Скрыть пароль" else "Показать пароль",
              )
            }
          },
        )

        if (!error.isNullOrBlank()) {
          Surface(
            shape = RoundedCornerShape(10.dp),
            color = colors.urgentSoft,
            modifier = Modifier.fillMaxWidth(),
          ) {
            Text(
              text = error,
              style = MaterialTheme.typography.bodyMedium,
              color = colors.urgent,
              modifier = Modifier.padding(12.dp),
            )
          }
        }

        Button(
          onClick = { onLogin(serverUrl, email, password) },
          enabled = !isLoading,
          modifier = Modifier
            .fillMaxWidth()
            .height(50.dp),
          shape = RoundedCornerShape(12.dp),
          colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
        ) {
          if (isLoading) {
            CircularProgressIndicator(
              modifier = Modifier.size(20.dp),
              color = Color.White,
              strokeWidth = 2.dp,
            )
          } else {
            Text("Войти", style = MaterialTheme.typography.titleMedium, color = Color.White)
          }
        }
      }
    }
  }
}
