package com.example.musicflow.data

import com.example.musicflow.data.api.MusicApiService
import com.example.musicflow.data.local.*
import com.example.musicflow.data.model.*
import com.example.musicflow.data.search.*
import com.example.musicflow.data.recommendation.*
import androidx.work.*
import com.example.musicflow.worker.DownloadWorker
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class MusicRepository(
    private val api: MusicApiService,
    private val lrcApi: com.example.musicflow.data.api.LrcLibApiService,
    private val dao: MusicDao,
    private val workManager: WorkManager,
    private val userPreferences: UserPreferences,
    private val context: android.content.Context? = null
) {
    
    suspend fun getPreferredQuality(): String {
        return userPreferences.audioQuality.first()
    }

    companion object {
        private val lyricsMemoryCache = java.util.concurrent.ConcurrentHashMap<String, LyricsData>()

        fun cleanSearchQuery(query: String): String {
            var q = query.trim().replace(Regex("""\s+"""), " ")
            val prefixes = listOf("play me the song ", "play the song ", "stream the song ", "listen to the song ", "play audio of ", "play video of ")
            for (p in prefixes) {
                if (q.startsWith(p, ignoreCase = true)) {
                    val candidate = q.substring(p.length).trim()
                    if (candidate.isNotBlank()) {
                        q = candidate
                    }
                }
            }
            return q
        }

        fun cleanTrackTitle(name: String): String {
            return name
                .replace(Regex("""\(.*?\)""", RegexOption.DOT_MATCHES_ALL), "")
                .replace(Regex("""\[.*?\]""", RegexOption.DOT_MATCHES_ALL), "")
                .replace(Regex("""(?i)feat\..*|ft\..*|prod\..*|official.*|slowed.*|reverb.*"""), "")
                .trim()
        }

        fun cleanArtistName(artists: String): String {
            val first = artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim() ?: ""
            return first.replace(Regex("""(?i)feat\..*|ft\..*"""), "").trim()
        }
    }

    // --- Upgraded Search & Recommendation Engine (Typesense Primary + Multi-Signal Fallback) ---

    suspend fun searchSongs(query: String, limit: Int = 50, page: Int = 1): List<Song> {
        val quality = getPreferredQuality()
        val parsed = QueryNormalizer.parseCompoundQuery(query)
        if (parsed.normalizedQuery.isBlank()) return emptyList()

        // 1. Try Typesense Search Engine first
        val tsSongs = com.example.musicflow.data.typesense.TypesenseSearchEngine.searchSongs(query)
        if (!tsSongs.isNullOrEmpty()) {
            return tsSongs
        }

        // 2. Fallback to upstream live search + Multi-Signal ranking
        return try {
            val queriesToTry = if (parsed.isCompoundQuery && !parsed.candidateSongTitle.isNullOrBlank()) {
                listOf(parsed.candidateSongTitle, parsed.normalizedQuery)
            } else if (parsed.candidateArtist != null) {
                listOf(parsed.normalizedQuery, parsed.candidateArtist)
            } else {
                listOf(parsed.normalizedQuery)
            }
            val results = mutableListOf<Song>()
            val pagesToTry = if (page == 1) listOf(1, 2, 3, 4, 5) else listOf(page, page + 1)
            for (q in queriesToTry) {
                for (p in pagesToTry) {
                    try {
                        val resp = api.searchSongs(q, limit, p)
                        val list = resp.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
                        results.addAll(list)
                    } catch (_: Exception) {}
                }
            }
            SearchEngine.rankSongs(results, parsed)
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "searchSongs failed: ${e.message}", e)
            emptyList()
        }
    }

    suspend fun searchComprehensiveSongs(query: String): List<Song> {
        val quality = getPreferredQuality()
        val parsed = QueryNormalizer.parseCompoundQuery(query)
        if (parsed.normalizedQuery.isBlank()) return emptyList()

        // 1. Try Typesense Search Engine first
        val tsSongs = com.example.musicflow.data.typesense.TypesenseSearchEngine.searchSongs(query)
        if (!tsSongs.isNullOrEmpty()) {
            val ranked = SearchEngine.rankSongs(tsSongs, parsed)
            return com.example.musicflow.data.search.TrackDeduplicator.deduplicate(ranked, query)
        }

        // 2. Fallback to multi-candidate live federated search with supervisorScope
        return try {
            supervisorScope {
                // A. Primary Direct Songs Search across multiple pages
                val directSongsDeferred = (1..5).map { p ->
                    async {
                        try {
                            api.searchSongs(parsed.normalizedQuery, limit = 50, page = p)
                                .body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                }

                // B. Sub-query for Compound Intent (e.g. Song Title only if user typed "Artist Song")
                val subQuerySongsDef = if (parsed.isCompoundQuery && !parsed.candidateSongTitle.isNullOrBlank()) {
                    async {
                        try {
                            api.searchSongs(parsed.candidateSongTitle, limit = 30, page = 1)
                                .body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                } else null

                // C. Artist Search & Artist Songs
                val artistTarget = parsed.candidateArtist ?: parsed.normalizedQuery
                val artistSearchDef = async {
                    try {
                        api.searchArtists(artistTarget, limit = 3, page = 1)
                            .body()?.data?.results?.firstOrNull()?.id
                    } catch (e: Exception) {
                        null
                    }
                }

                // D. Playlists & Albums Search
                val playlistsDef = async {
                    try {
                        api.searchPlaylists(parsed.normalizedQuery, limit = 4, page = 1)
                            .body()?.data?.results ?: emptyList()
                    } catch (e: Exception) {
                        emptyList()
                    }
                }

                val albumsDef = async {
                    try {
                        api.searchAlbums(parsed.normalizedQuery, limit = 4, page = 1)
                            .body()?.data?.results ?: emptyList()
                    } catch (e: Exception) {
                        emptyList()
                    }
                }

                val directSongs = directSongsDeferred.flatMap {
                    try { it.await() } catch (e: Exception) { emptyList() }
                }
                val subSongs = try { subQuerySongsDef?.await() ?: emptyList() } catch (e: Exception) { emptyList() }
                val topArtistId = try { artistSearchDef.await() } catch (e: Exception) { null }
                val playlistDtos = try { playlistsDef.await() } catch (e: Exception) { emptyList() }
                val albumDtos = try { albumsDef.await() } catch (e: Exception) { emptyList() }

                val artistTopSongsDef = if (!topArtistId.isNullOrBlank()) {
                    async {
                        try {
                            api.getArtistSongs(topArtistId)
                                .body()?.data?.songs?.map { it.toDomain(quality) } ?: emptyList()
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                } else null

                val playlistSongsDeferred = playlistDtos.map { playlistDto ->
                    async {
                        try {
                            val pid = playlistDto.id ?: return@async emptyList<Song>()
                            api.getPlaylistDetails(pid)
                                .body()?.data?.songs?.map { it.toDomain(quality) } ?: emptyList()
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                }

                val albumSongsDeferred = albumDtos.map { albumDto ->
                    async {
                        try {
                            val aid = albumDto.id ?: return@async emptyList<Song>()
                            api.getAlbumDetails(aid)
                                .body()?.data?.songs?.map { it.toDomain(quality) } ?: emptyList()
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                }

                val artistTopSongs = try { artistTopSongsDef?.await() ?: emptyList() } catch (e: Exception) { emptyList() }
                val playlistSongs = mutableListOf<Song>()
                for (def in playlistSongsDeferred) {
                    try { playlistSongs.addAll(def.await()) } catch (e: Exception) {}
                }
                val albumSongs = mutableListOf<Song>()
                for (def in albumSongsDeferred) {
                    try { albumSongs.addAll(def.await()) } catch (e: Exception) {}
                }

                // Combine all candidate streams
                val allCandidates: List<Song> = directSongs + subSongs + artistTopSongs + playlistSongs + albumSongs

                // Rank using Multi-Signal SearchEngine
                SearchEngine.rankSongs(allCandidates, parsed)
            }
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "searchComprehensiveSongs failed: ${e.message}", e)
            searchSongs(query)
        }
    }

    suspend fun searchAllCategories(query: String): EnhancedSearchResult {
        val quality = getPreferredQuality()
        val parsed = QueryNormalizer.parseCompoundQuery(query)
        val didYouMean = SearchEngine.detectDidYouMean(query)

        return supervisorScope {
            val songsDef = async { searchComprehensiveSongs(query) }
            val albumsDef = async { searchAlbums(query, limit = 20) }
            val artistsDef = async { searchArtists(query, limit = 20) }
            val playlistsDef = async { searchPlaylists(query, limit = 20) }

            val rawSongs = try { songsDef.await() } catch (e: Exception) { emptyList() }
            val rawAlbums = try { albumsDef.await() } catch (e: Exception) { emptyList() }
            val rawArtists = try { artistsDef.await() } catch (e: Exception) { emptyList() }
            val rawPlaylists = try { playlistsDef.await() } catch (e: Exception) { emptyList() }

            EnhancedSearchResult(
                query = query,
                normalizedQuery = parsed.normalizedQuery,
                songs = rawSongs,
                artists = SearchEngine.rankArtists(rawArtists, parsed),
                albums = SearchEngine.rankAlbums(rawAlbums, parsed),
                playlists = rawPlaylists.distinctBy { it.id },
                didYouMean = didYouMean,
                suggestions = SearchEngine.getAutocompleteSuggestions(query)
            )
        }
    }

    suspend fun searchAlbums(query: String, limit: Int = 20, page: Int = 1): List<Album> {
        val quality = getPreferredQuality()
        val parsed = QueryNormalizer.parseCompoundQuery(query)
        val target = if (parsed.isCompoundQuery && !parsed.candidateSongTitle.isNullOrBlank()) parsed.candidateSongTitle else parsed.normalizedQuery
        return try {
            val response = api.searchAlbums(target, limit, page)
            val results = response.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
            SearchEngine.rankAlbums(results, parsed)
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "searchAlbums failed: ${e.message}", e)
            emptyList()
        }
    }

    suspend fun searchArtists(query: String, limit: Int = 20, page: Int = 1): List<Artist> {
        val parsed = QueryNormalizer.parseCompoundQuery(query)
        val target = parsed.candidateArtist ?: parsed.normalizedQuery
        return try {
            val response = api.searchArtists(target, limit, page)
            val results = response.body()?.data?.results?.map { it.toDomain() } ?: emptyList()
            if (results.isNotEmpty()) {
                SearchEngine.rankArtists(results, parsed)
            } else if (parsed.normalizedQuery != target) {
                val fallback = api.searchArtists(parsed.normalizedQuery, limit, page).body()?.data?.results?.map { it.toDomain() } ?: emptyList()
                SearchEngine.rankArtists(fallback, parsed)
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "searchArtists failed: ${e.message}", e)
            emptyList()
        }
    }

    suspend fun searchPlaylists(query: String, limit: Int = 20, page: Int = 1): List<Playlist> {
        val quality = getPreferredQuality()
        val parsed = QueryNormalizer.parseCompoundQuery(query)
        return try {
            val response = api.searchPlaylists(parsed.normalizedQuery, limit, page)
            response.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "searchPlaylists failed: ${e.message}", e)
            emptyList()
        }
    }

    suspend fun getTopCharts(limit: Int = 10): List<Playlist> {
        val quality = getPreferredQuality()
        return try {
            val response = api.searchPlaylists("Trending Playlists", limit = limit, page = 1)
            val results = response.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
            if (results.isNotEmpty()) {
                results
            } else {
                val fallbackResponse = api.searchPlaylists("Top Charts", limit = limit, page = 1)
                fallbackResponse.body()?.data?.results?.map { it.toDomain(quality) } ?: emptyList()
            }
        } catch (e: Exception) {
            emptyList()
        }
    }


    suspend fun getSongDetails(id: String): Song? {
        val quality = getPreferredQuality()
        return try {
            val response = api.getSongDetails(id)
            response.body()?.data?.firstOrNull()?.toDomain(quality)
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "getSongDetails failed for id $id: ${e.message}", e)
            null
        }
    }

    suspend fun getAlbumDetails(id: String): Album? {
        val quality = getPreferredQuality()
        return try {
            val response = api.getAlbumDetails(id)
            response.body()?.data?.toDomain(quality)
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "getAlbumDetails failed for id $id: ${e.message}", e)
            null
        }
    }

    suspend fun getPlaylistDetails(id: String): Playlist? {
        val quality = getPreferredQuality()
        return try {
            val response = api.getPlaylistDetails(id)
            response.body()?.data?.toDomain(quality)
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "getPlaylistDetails failed for id $id: ${e.message}", e)
            null
        }
    }

    suspend fun getArtistDetails(id: String): Artist? {
        val quality = getPreferredQuality()
        return try {
            val response = api.getArtistDetails(id)
            val data = response.body()?.data
            if (data != null) {
                data.toDomain(quality)
            } else {
                val pathRes = api.getArtistDetailsByPath(id)
                pathRes.body()?.data?.toDomain(quality)
            }
        } catch (e: Exception) {
            try {
                val pathRes = api.getArtistDetailsByPath(id)
                pathRes.body()?.data?.toDomain(quality)
            } catch (ex: Exception) {
                android.util.Log.e("MusicRepository", "getArtistDetails failed for id $id: ${ex.message}")
                null
            }
        }
    }

    suspend fun getArtistSongs(id: String): List<Song> {
        val quality = getPreferredQuality()
        return try {
            val response = api.getArtistSongs(id)
            response.body()?.data?.songs?.map { it.toDomain(quality) } ?: emptyList()
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "getArtistSongs failed for id $id: ${e.message}", e)
            emptyList()
        }
    }

    suspend fun getArtistAlbums(id: String): List<Album> {
        val quality = getPreferredQuality()
        return try {
            val response = api.getArtistAlbums(id)
            response.body()?.data?.albums?.map { it.toDomain(quality) } ?: emptyList()
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "getArtistAlbums failed for id $id: ${e.message}", e)
            emptyList()
        }
    }

    suspend fun getLyrics(song: Song): LyricsData? {
        val cleanTitle = cleanTrackTitle(song.name)
        if (cleanTitle.isBlank()) return null
        val cleanArtist = cleanArtistName(song.artists)
        val cacheKey = "${cleanTitle.lowercase()}__${cleanArtist.lowercase()}".trim()

        // 1. Instant Memory Cache Check (0ms response)
        lyricsMemoryCache[cacheKey]?.let { return it }

        // 2. Local Database Cache Check (Persistent offline cache)
        try {
            val cachedEntity = dao.getLyricsCache(cacheKey)
            if (cachedEntity != null && (!cachedEntity.syncedLyrics.isNullOrBlank() || !cachedEntity.plainLyrics.isNullOrBlank())) {
                val cachedData = LyricsData(
                    syncedLyrics = cachedEntity.syncedLyrics,
                    plainLyrics = cachedEntity.plainLyrics
                )
                lyricsMemoryCache[cacheKey] = cachedData
                return cachedData
            }
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "Error reading lyrics cache: ${e.message}")
        }

        // 3. Fast Parallel Multi-Query Execution against LRCLIB
        val secondaryArtist = if (song.artists.contains(",")) {
            song.artists.split(",").getOrNull(1)?.trim()?.replace(Regex("""(?i)feat\..*|ft\..*"""), "")?.trim()
        } else if (song.artists.contains("&")) {
            song.artists.split("&").getOrNull(1)?.trim()?.replace(Regex("""(?i)feat\..*|ft\..*"""), "")?.trim()
        } else null

        var lyricsResult: LyricsData? = null

        try {
            coroutineScope {
                val q1 = async {
                    try {
                        val res = lrcApi.searchLyrics("$cleanTitle $cleanArtist".trim())
                        if (res.isSuccessful) res.body() else null
                    } catch (_: Exception) { null }
                }
                val q2 = async {
                    try {
                        val durationSec = if (song.duration > 0) song.duration else null
                        val res = lrcApi.getLyrics(trackName = cleanTitle, artistName = cleanArtist, duration = durationSec)
                        if (res.isSuccessful) res.body()?.let { listOf(it) } else null
                    } catch (_: Exception) { null }
                }
                val q3 = async {
                    try {
                        val res = lrcApi.searchLyrics(cleanTitle)
                        if (res.isSuccessful) res.body() else null
                    } catch (_: Exception) { null }
                }
                val q4 = if (!secondaryArtist.isNullOrBlank()) {
                    async {
                        try {
                            val res = lrcApi.searchLyrics("$cleanTitle $secondaryArtist".trim())
                            if (res.isSuccessful) res.body() else null
                        } catch (_: Exception) { null }
                    }
                } else null

                val r1 = q1.await() ?: emptyList()
                val r2 = q2.await() ?: emptyList()
                val r3 = q3.await() ?: emptyList()
                val r4 = q4?.await() ?: emptyList()

                val allCandidates = (r2 + r1 + r4 + r3)

                // Select candidate: prefer syncedLyrics first, then plainLyrics
                val bestMatch = allCandidates.firstOrNull { !it.syncedLyrics.isNullOrBlank() }
                    ?: allCandidates.firstOrNull { !it.plainLyrics.isNullOrBlank() }

                if (bestMatch != null && (!bestMatch.syncedLyrics.isNullOrBlank() || !bestMatch.plainLyrics.isNullOrBlank())) {
                    lyricsResult = LyricsData(
                        syncedLyrics = bestMatch.syncedLyrics,
                        plainLyrics = bestMatch.plainLyrics ?: bestMatch.syncedLyrics
                    )
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("MusicRepository", "LRCLIB query error: ${e.message}")
        }

        // 4. Fallback to Primary JioSaavn Lyrics API if LRCLIB returned null
        if (lyricsResult == null) {
            try {
                val primaryRes = api.getLyrics(song.id)
                val plain = primaryRes.body()?.data?.lyrics
                if (!plain.isNullOrBlank()) {
                    lyricsResult = LyricsData(
                        syncedLyrics = null,
                        plainLyrics = plain
                    )
                }
            } catch (_: Exception) {}
        }

        // 5. Store in Dual-Layer Cache
        lyricsResult?.let { result ->
            lyricsMemoryCache[cacheKey] = result
            try {
                dao.insertLyricsCache(
                    LyricsCacheEntity(
                        cacheKey = cacheKey,
                        syncedLyrics = result.syncedLyrics,
                        plainLyrics = result.plainLyrics
                    )
                )
            } catch (e: Exception) {
                android.util.Log.e("MusicRepository", "Error storing lyrics cache: ${e.message}")
            }
        }

        return lyricsResult
    }

    suspend fun getHomeModules(): HomeModulesDto? {
        val response = api.getHomeModules()
        if (response.isSuccessful) {
            val body = response.body()
            if (body?.success == true) {
                return body.data
            } else {
                throw Exception(body?.message ?: "API returned failure status")
            }
        } else {
            throw Exception("Network error: ${response.code()} ${response.message()}")
        }
    }

    suspend fun getPersonalizedRecommendations(candidatePool: List<Song>, limit: Int = 20): List<Song> {
        return try {
            val history = dao.getHistory().first().map { it.toDomain() }
            val favorites = dao.getFavorites().first().map { it.toDomain() }
            RecommendationEngine.getPersonalizedRecommendations(
                userHistory = history,
                userFavorites = favorites,
                candidatePool = candidatePool,
                limit = limit
            )
        } catch (e: Exception) {
            candidatePool.take(limit)
        }
    }

    suspend fun getTrackRadio(seedSong: Song, limit: Int = 25): List<Song> {
        return try {
            val seedArtist = TrackDeduplicator.cleanArtistName(seedSong.artists)
            val candidatePool = if (seedArtist.isNotBlank()) {
                searchComprehensiveSongs(seedArtist)
            } else {
                searchComprehensiveSongs(seedSong.name)
            }
            RecommendationEngine.getTrackRadio(seedSong, candidatePool, limit)
        } catch (e: Exception) {
            listOf(seedSong)
        }
    }

    // --- Local Storage (Favorites) ---

    fun getFavorites(): Flow<List<Song>> = dao.getFavorites().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun addFavorite(song: Song) {
        dao.insertSongMetadata(song.toMetadataEntity())
        dao.insertFavorite(song.toFavoriteEntity())
    }

    suspend fun removeFavorite(songId: String) {
        dao.deleteFavorite(songId)
    }

    suspend fun isFavorite(songId: String): Boolean = dao.isFavorite(songId)

    suspend fun toggleFavorite(song: Song) {
        if (isFavorite(song.id)) {
            removeFavorite(song.id)
        } else {
            addFavorite(song)
        }
    }

    // --- History ---

    fun getHistory(): Flow<List<Song>> = dao.getHistory().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun addHistory(song: Song) {
        dao.insertSongMetadata(song.toMetadataEntity())
        dao.insertHistory(song.toHistoryEntity())
    }

    suspend fun clearHistory() {
        dao.clearHistory()
    }

    suspend fun removeFromHistory(songId: String) {
        dao.deleteHistorySong(songId)
    }

    // --- Saved Albums ---

    fun getSavedAlbums(): Flow<List<Album>> = dao.getSavedAlbums().map { entities ->
        entities.map { Album(it.id, it.name, it.artist, it.image, it.year, it.songCount) }
    }

    suspend fun isAlbumSaved(albumId: String): Boolean = dao.isAlbumSaved(albumId)

    suspend fun toggleSaveAlbum(album: Album) {
        if (isAlbumSaved(album.id)) {
            dao.deleteSavedAlbum(album.id)
        } else {
            dao.insertSavedAlbum(
                SavedAlbumEntity(
                    id = album.id,
                    name = album.name,
                    artist = album.artist,
                    year = album.year,
                    image = album.image,
                    songCount = album.songCount
                )
            )
        }
    }

    // --- Playlists ---

    fun getPlaylists(): Flow<List<PlaylistEntity>> = dao.getPlaylists()

    suspend fun addPlaylist(playlist: PlaylistEntity) {
        dao.insertPlaylist(playlist)
    }

    suspend fun removePlaylist(playlistId: String) {
        dao.deletePlaylist(playlistId)
    }

    suspend fun renamePlaylist(playlistId: String, newName: String) {
        dao.renamePlaylist(playlistId, newName)
    }

    fun getPlaylistSongs(playlistId: String): Flow<List<Song>> = dao.getPlaylistSongs(playlistId).map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun addSongToPlaylist(playlistId: String, song: Song) {
        dao.insertSongMetadata(song.toMetadataEntity())
        dao.insertPlaylistSong(PlaylistSongCrossRef(playlistId, song.id))
    }

    suspend fun removeSongFromPlaylist(playlistId: String, songId: String) {
        dao.deletePlaylistSong(playlistId, songId)
    }

    fun getAllSongs(): Flow<List<Song>> = dao.getAllSongs().map { entities ->
        entities.map { it.toDomain() }
    }

    // --- Downloads ---

    fun getDownloads(): Flow<List<Song>> = dao.getDownloads().map { entities ->
        entities.map { it.toDomain() }
    }

    fun downloadSong(song: Song) {
        val downloadUrl = song.downloadUrls.lastOrNull()?.url ?: song.streamUrl
        if (downloadUrl.isBlank()) return

        val workRequest = OneTimeWorkRequestBuilder<DownloadWorker>()
            .setInputData(
                DownloadWorker.createInputData(
                    songId = song.id,
                    songName = song.name,
                    artists = song.artists,
                    album = song.album,
                    imageUrl = song.image,
                    downloadUrl = downloadUrl,
                    duration = song.duration
                )
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        workManager.enqueueUniqueWork(
            "${DownloadWorker.WORK_NAME_PREFIX}${song.id}",
            ExistingWorkPolicy.KEEP,
            workRequest
        )
    }

    suspend fun isDownloaded(songId: String): Boolean = dao.isDownloaded(songId)

    suspend fun deleteDownload(songId: String) {
        dao.deleteDownload(songId)
        // Also delete the file (logic can be added here or in worker)
    }

    // --- Followed Artists ---

    fun getFollowedArtists(): Flow<List<Artist>> = dao.getFollowedArtists().map { entities ->
        entities.map { Artist(it.id, it.name, it.image) }
    }

    suspend fun isArtistFollowed(artistId: String): Boolean = dao.isArtistFollowed(artistId)

    suspend fun toggleFollowArtist(artist: Artist) {
        if (isArtistFollowed(artist.id)) {
            dao.deleteFollowedArtist(artist.id)
        } else {
            dao.insertFollowedArtist(FollowedArtistEntity(artist.id, artist.name, artist.image))
        }
    }

    // --- Local Device Audio Scanner & Management ---

    suspend fun scanLocalAudio(ctx: android.content.Context? = null) {
        val targetContext = ctx ?: context ?: return
        com.example.musicflow.data.local.MediaStoreAudioScanner.scanDeviceAudio(targetContext, dao)
    }

    fun getLocalTracks(): Flow<List<Song>> = dao.getLocalTracks().map { entities ->
        entities.map { it.toDomain() }
    }

    suspend fun deleteLocalTrack(id: String) {
        dao.deleteLocalTrack(id)
    }

    suspend fun searchOfflineTracks(query: String): List<Song> {
        val localMatches = dao.searchLocalTracks(query).map { it.toDomain() }
        val downloads = dao.getDownloads().first().map { it.toDomain() }
            .filter { it.name.contains(query, ignoreCase = true) || it.artists.contains(query, ignoreCase = true) }
        return (downloads + localMatches).distinctBy { it.id }
    }

    fun batchDownloadSongs(songs: List<Song>) {
        songs.forEach { downloadSong(it) }
    }

    // --- Embeat Recommendations & Radio ---

    suspend fun getSimilarSongs(song: Song, limit: Int = 20): List<Song> {
        return try {
            val query = "${song.artists} ${song.album}".trim()
            val results = searchSongs(query, 1, limit)
            results.filter { it.id != song.id }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
