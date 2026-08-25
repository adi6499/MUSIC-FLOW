package com.example.musicflow.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.musicflow.ui.theme.*

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    onSeeAllClick: (() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Dimens.ScreenPadding, vertical = Dimens.PaddingLarge),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.displayMedium,
            color = Color.White
        )
        if (onSeeAllClick != null) {
            Text(
                text = "SEE ALL",
                style = MaterialTheme.typography.labelSmall,
                color = MusicAccent,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clickable(onClick = onSeeAllClick)
                    .padding(bottom = 4.dp)
            )
        }
    }
}
