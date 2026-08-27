package com.example.musicflow.data.typesense

import android.util.Log
import com.example.musicflow.data.model.Song
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object TypesenseSearchEngine {

    private const val TAG = "TypesenseEngine"

    private val gson: Gson = GsonBuilder()
        .setLenient()
        .create()

    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(1500, TimeUnit.MILLISECONDS)
        .readTimeout(2000, TimeUnit.MILLISECONDS)
        .build()

    private val apiService: TypesenseApiService by lazy {
        Retrofit.Builder()
            .baseUrl(TypesenseConfig.baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(TypesenseApiService::class.java)
    }

    private var isHealthyCached: Boolean? = null
    private var lastHealthCheckTime: Long = 0L

    suspend fun isAvailable(): Boolean = withContext(Dispatchers.IO) {
        if (!TypesenseConfig.isEnabled) return@withContext false
        val now = System.currentTimeMillis()
        if (isHealthyCached != null && (now - lastHealthCheckTime) < 30_000) {
            return@withContext isHealthyCached ?: false
        }

        try {
            val response = apiService.healthCheck(TypesenseConfig.apiKey)
            val healthy = response.isSuccessful
            isHealthyCached = healthy
            lastHealthCheckTime = now
            healthy
        } catch (e: Exception) {
            isHealthyCached = false
            lastHealthCheckTime = now
            false
        }
    }

    suspend fun searchSongs(query: String): List<Song>? = withContext(Dispatchers.IO) {
        if (!TypesenseConfig.isEnabled) return@withContext null
        if (!isAvailable()) return@withContext null

        try {
            val request = MultiSearchRequest(
                searches = listOf(
                    SearchQueryItem(
                        collection = "songs",
                        q = query,
                        queryBy = "title,artist,album,normalized_title,normalized_artist,normalized_album",
                        queryByWeights = "12,8,4,10,7,3",
                        sortBy = "_text_match:desc,popularity:desc",
                        numTypos = "2",
                        typoTokensThreshold = 1,
                        dropTokensThreshold = 1,
                        prioritizeExactMatch = true,
                        prefix = true,
                        infix = "always",
                        perPage = 30
                    )
                )
            )

            val response = apiService.multiSearch(TypesenseConfig.apiKey, request)
            if (response.isSuccessful && response.body() != null) {
                val hits = response.body()?.results?.firstOrNull()?.hits ?: emptyList()
                val songs = hits.map { it.document.toDomain() }
                if (songs.isNotEmpty()) {
                    Log.d(TAG, "Successfully retrieved ${songs.size} songs for '$query' from Typesense")
                    return@withContext songs
                }
            }
            null
        } catch (e: Exception) {
            Log.w(TAG, "Typesense search error, falling back to local engine: ${e.message}")
            null
        }
    }
}
