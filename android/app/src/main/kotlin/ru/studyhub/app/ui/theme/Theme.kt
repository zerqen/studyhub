package ru.studyhub.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

@Immutable
data class StudyHubExtendedColors(
  val bg: Color,
  val surface: Color,
  val subtle: Color,
  val line: Color,
  val fg: Color,
  val muted: Color,
  val accent: Color,
  val accentSoft: Color,
  val success: Color,
  val warning: Color,
  val danger: Color,
  val urgent: Color,
  val urgentSoft: Color,
)

private val LightExtended = StudyHubExtendedColors(
  bg = InkLightBg,
  surface = InkLightSurface,
  subtle = InkLightSubtle,
  line = InkLightLine,
  fg = InkLightFg,
  muted = InkLightMuted,
  accent = InkLightAccent,
  accentSoft = InkLightAccentSoft,
  success = InkLightSuccess,
  warning = InkLightWarning,
  danger = InkLightDanger,
  urgent = InkLightUrgent,
  urgentSoft = InkLightUrgentSoft,
)

private val DarkExtended = StudyHubExtendedColors(
  bg = InkDarkBg,
  surface = InkDarkSurface,
  subtle = InkDarkSubtle,
  line = InkDarkLine,
  fg = InkDarkFg,
  muted = InkDarkMuted,
  accent = InkDarkAccent,
  accentSoft = InkDarkAccentSoft,
  success = InkDarkSuccess,
  warning = InkDarkWarning,
  danger = InkDarkDanger,
  urgent = InkDarkUrgent,
  urgentSoft = InkDarkUrgentSoft,
)

val LocalStudyHubColors = staticCompositionLocalOf { LightExtended }

private val LightColorScheme = lightColorScheme(
  primary = InkLightAccent,
  onPrimary = Color.White,
  primaryContainer = InkLightAccentSoft,
  onPrimaryContainer = InkLightAccent,
  secondary = InkLightUrgent,
  onSecondary = Color.White,
  secondaryContainer = InkLightUrgentSoft,
  onSecondaryContainer = InkLightUrgent,
  background = InkLightBg,
  onBackground = InkLightFg,
  surface = InkLightSurface,
  onSurface = InkLightFg,
  surfaceVariant = InkLightSubtle,
  onSurfaceVariant = InkLightMuted,
  outline = InkLightLine,
  outlineVariant = InkLightLine,
  error = InkLightDanger,
  onError = Color.White,
)

private val DarkColorScheme = darkColorScheme(
  primary = InkDarkAccent,
  onPrimary = Color.White,
  primaryContainer = InkDarkAccentSoft,
  onPrimaryContainer = InkDarkAccent,
  secondary = InkDarkUrgent,
  onSecondary = Color.Black,
  secondaryContainer = InkDarkUrgentSoft,
  onSecondaryContainer = InkDarkUrgent,
  background = InkDarkBg,
  onBackground = InkDarkFg,
  surface = InkDarkSurface,
  onSurface = InkDarkFg,
  surfaceVariant = InkDarkSubtle,
  onSurfaceVariant = InkDarkMuted,
  outline = InkDarkLine,
  outlineVariant = InkDarkLine,
  error = InkDarkDanger,
  onError = Color.Black,
)

@Composable
fun StudyHubTheme(
  themeMode: String = "system",
  content: @Composable () -> Unit,
) {
  val darkTheme = when (themeMode) {
    "dark" -> true
    "light" -> false
    else -> isSystemInDarkTheme()
  }
  val extended = if (darkTheme) DarkExtended else LightExtended
  val scheme = if (darkTheme) DarkColorScheme else LightColorScheme

  CompositionLocalProvider(LocalStudyHubColors provides extended) {
    MaterialTheme(
      colorScheme = scheme,
      typography = StudyHubTypography,
      content = content,
    )
  }
}

object StudyHubThemeColors {
  val current: StudyHubExtendedColors
    @Composable get() = LocalStudyHubColors.current
}
