package com.example.musicflow.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

object MFIcons {

    // 1. HOME: Rounded Triangle icon (Image 4)
    val Home: ImageVector by lazy {
        ImageVector.Builder(
            name = "Home",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = SolidColor(Color.White),
                fillAlpha = 1.0f,
                stroke = null,
                pathFillType = PathFillType.NonZero
            ) {
                moveTo(10.3f, 4.4f)
                curveTo(11.1f, 3.1f, 12.9f, 3.1f, 13.7f, 4.4f)
                lineTo(20.8f, 16.6f)
                curveTo(21.6f, 18.0f, 20.6f, 19.8f, 19.1f, 19.8f)
                horizontalLineTo(4.9f)
                curveTo(3.4f, 19.8f, 2.4f, 18.0f, 3.2f, 16.6f)
                close()
            }
        }.build()
    }

    // 2. NAVIGATOR: Angled Rhombus / Parallelogram icon (Image 4)
    val Navigator: ImageVector by lazy {
        ImageVector.Builder(
            name = "Navigator",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = SolidColor(Color.White),
                fillAlpha = 1.0f,
                stroke = null,
                pathFillType = PathFillType.NonZero
            ) {
                moveTo(8.5f, 4.5f)
                curveTo(9.0f, 3.6f, 10.0f, 3.0f, 11.0f, 3.0f)
                horizontalLineTo(18.5f)
                curveTo(19.9f, 3.0f, 21.0f, 4.1f, 21.0f, 5.5f)
                curveTo(21.0f, 5.9f, 20.9f, 6.3f, 20.7f, 6.6f)
                lineTo(15.5f, 19.5f)
                curveTo(15.0f, 20.4f, 14.0f, 21.0f, 13.0f, 21.0f)
                horizontalLineTo(5.5f)
                curveTo(4.1f, 21.0f, 3.0f, 19.9f, 3.0f, 18.5f)
                curveTo(3.0f, 18.1f, 3.1f, 17.7f, 3.3f, 17.4f)
                close()
            }
        }.build()
    }

    // 3. SEARCH: Solid Lens / Dot Search Icon (Image 4)
    val Search: ImageVector by lazy {
        ImageVector.Builder(
            name = "Search",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = SolidColor(Color.White),
                fillAlpha = 1.0f,
                stroke = null,
                pathFillType = PathFillType.NonZero
            ) {
                moveTo(10.5f, 3.0f)
                curveTo(14.64f, 3.0f, 18.0f, 6.36f, 18.0f, 10.5f)
                curveTo(18.0f, 12.3f, 17.36f, 13.95f, 16.29f, 15.23f)
                lineTo(20.53f, 19.47f)
                curveTo(20.82f, 19.76f, 20.82f, 20.24f, 20.53f, 20.53f)
                curveTo(20.24f, 20.82f, 19.76f, 20.82f, 19.47f, 20.53f)
                lineTo(15.23f, 16.29f)
                curveTo(13.95f, 17.36f, 12.3f, 18.0f, 10.5f, 18.0f)
                curveTo(6.36f, 18.0f, 3.0f, 14.64f, 3.0f, 10.5f)
                curveTo(3.0f, 6.36f, 6.36f, 3.0f, 10.5f, 3.0f)
                close()
            }
        }.build()
    }

    // 4. MY MUSIC: Rightward Play Badge / Library Icon (Image 4)
    val MyMusic: ImageVector by lazy {
        ImageVector.Builder(
            name = "MyMusic",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = SolidColor(Color.White),
                fillAlpha = 1.0f,
                stroke = null,
                pathFillType = PathFillType.NonZero
            ) {
                moveTo(6.5f, 4.5f)
                curveTo(6.5f, 3.3f, 7.8f, 2.5f, 8.9f, 3.1f)
                lineTo(20.0f, 10.6f)
                curveTo(21.0f, 11.2f, 21.0f, 12.8f, 20.0f, 13.4f)
                lineTo(8.9f, 20.9f)
                curveTo(7.8f, 21.5f, 6.5f, 20.7f, 6.5f, 19.5f)
                close()
            }
        }.build()
    }

    // 5. PROFILE: Round Avatar Icon (Image 4)
    val Profile: ImageVector by lazy {
        ImageVector.Builder(
            name = "Profile",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = SolidColor(Color.White),
                fillAlpha = 1.0f,
                stroke = null,
                pathFillType = PathFillType.NonZero
            ) {
                moveTo(12.0f, 12.0f)
                curveTo(14.21f, 12.0f, 16.0f, 10.21f, 16.0f, 8.0f)
                curveTo(16.0f, 5.79f, 14.21f, 4.0f, 12.0f, 4.0f)
                curveTo(9.79f, 4.0f, 8.0f, 5.79f, 8.0f, 8.0f)
                curveTo(8.0f, 10.21f, 9.79f, 12.0f, 12.0f, 12.0f)
                close()
                moveTo(12.0f, 14.0f)
                curveTo(8.67f, 14.0f, 4.0f, 15.67f, 4.0f, 19.0f)
                verticalLineTo(20.0f)
                horizontalLineTo(20.0f)
                verticalLineTo(19.0f)
                curveTo(20.0f, 15.67f, 15.33f, 14.0f, 12.0f, 14.0f)
                close()
            }
        }.build()
    }

    // 6. MORE: 2x2 Four Dots Grid Icon (Image 4)
    val MoreGrid: ImageVector by lazy {
        ImageVector.Builder(
            name = "MoreGrid",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = SolidColor(Color.White),
                fillAlpha = 1.0f,
                stroke = null,
                pathFillType = PathFillType.NonZero
            ) {
                // Top-Left dot
                moveTo(7.5f, 6.0f)
                curveTo(8.33f, 6.0f, 9.0f, 6.67f, 9.0f, 7.5f)
                curveTo(9.0f, 8.33f, 8.33f, 9.0f, 7.5f, 9.0f)
                curveTo(6.67f, 9.0f, 6.0f, 8.33f, 6.0f, 7.5f)
                curveTo(6.0f, 6.67f, 6.67f, 6.0f, 7.5f, 6.0f)
                close()
                // Top-Right dot
                moveTo(16.5f, 6.0f)
                curveTo(17.33f, 6.0f, 18.0f, 6.67f, 18.0f, 7.5f)
                curveTo(18.0f, 8.33f, 17.33f, 9.0f, 16.5f, 9.0f)
                curveTo(15.67f, 9.0f, 15.0f, 8.33f, 15.0f, 7.5f)
                curveTo(15.0f, 6.67f, 15.67f, 6.0f, 16.5f, 6.0f)
                close()
                // Bottom-Left dot
                moveTo(7.5f, 15.0f)
                curveTo(8.33f, 15.0f, 9.0f, 15.67f, 9.0f, 16.5f)
                curveTo(9.0f, 17.33f, 8.33f, 18.0f, 7.5f, 18.0f)
                curveTo(6.67f, 18.0f, 6.0f, 17.33f, 6.0f, 16.5f)
                curveTo(6.0f, 15.67f, 6.67f, 15.0f, 7.5f, 15.0f)
                close()
                // Bottom-Right dot
                moveTo(16.5f, 15.0f)
                curveTo(17.33f, 15.0f, 18.0f, 15.67f, 18.0f, 16.5f)
                curveTo(18.0f, 17.33f, 17.33f, 18.0f, 16.5f, 18.0f)
                curveTo(15.67f, 18.0f, 15.0f, 17.33f, 15.0f, 16.5f)
                curveTo(15.0f, 15.67f, 15.67f, 15.0f, 16.5f, 15.0f)
                close()
            }
        }.build()
    }
}
