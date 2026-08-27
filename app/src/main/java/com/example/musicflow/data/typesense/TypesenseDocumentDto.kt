package com.example.musicflow.data.typesense

import com.example.musicflow.data.model.Song
import com.google.gson.annotations.SerializedName

data class MultiSearchRequest(
    @SerializedName("searches") val searches: List<SearchQueryItem>
)

data class SearchQueryItem(
    @SerializedName("collection") val collection: String,
    @SerializedName("q") val q: String,
    @SerializedName("query_by") val queryBy: String,
    @SerializedName("query_by_weights") val queryByWeights: String? = null,
    @SerializedName("sort_by") val sortBy: String? = null,
    @SerializedName("num_typos") val numTypos: String? = null,
    @SerializedName("typo_tokens_threshold") val typoTokensThreshold: Int? = null,
    @SerializedName("drop_tokens_threshold") val dropTokensThreshold: Int? = null,
    @SerializedName("prioritize_exact_match") val prioritizeExactMatch: Boolean? = true,
    @SerializedName("prefix") val prefix: Boolean? = true,
    @SerializedName("infix") val infix: String? = "always",
    @SerializedName("per_page") val perPage: Int = 30
)

data class MultiSearchResponse(
    @SerializedName("results") val results: List<SearchResultItem>?
)

data class SearchResultItem(
    @SerializedName("hits") val hits: List<SearchHit>?
)

data class SearchHit(
    @SerializedName("document") val document: SongDocument
)

data class SongDocument(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("artist") val artist: String,
    @SerializedName("album") val album: String? = null,
    @SerializedName("year") val year: Int? = null,
    @SerializedName("duration") val duration: Int? = null,
    @SerializedName("cover_art") val coverArt: String? = null,
    @SerializedName("audio_url") val audioUrl: String? = null,
    @SerializedName("stream_url") val streamUrl: String? = null,
    @SerializedName("has_lyrics") val hasLyrics: Boolean? = false,
    @SerializedName("language") val language: String? = "hindi",
    @SerializedName("provider") val provider: String? = "Typesense"
) {
    fun toDomain(): Song = Song(
        id = id,
        name = title,
        artists = artist,
        album = album ?: "",
        year = year?.toString() ?: "2024",
        duration = duration ?: 200,
        image = coverArt ?: "https://example.com/500x500/cover.jpg",
        streamUrl = streamUrl ?: audioUrl ?: "",
        downloadUrls = emptyList(),
        hasLyrics = hasLyrics ?: false,
        language = language ?: "hindi"
    )
}
