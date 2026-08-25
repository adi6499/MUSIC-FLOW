package com.example.musicflow.ui.artist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musicflow.data.MusicRepository
import com.example.musicflow.data.model.Artist
import com.example.musicflow.data.model.Song
import com.example.musicflow.data.model.Album
import com.example.musicflow.player.MusicController
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class ArtistViewModel(
    private val repository: MusicRepository,
    private val musicController: MusicController
) : ViewModel() {

    private val _artist = MutableStateFlow<Artist?>(null)
    val artist: StateFlow<Artist?> = _artist.asStateFlow()

    private val _topSongs = MutableStateFlow<List<Song>>(emptyList())
    val topSongs: StateFlow<List<Song>> = _topSongs.asStateFlow()

    private val _albums = MutableStateFlow<List<Album>>(emptyList())
    val albums: StateFlow<List<Album>> = _albums.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _isFollowed = MutableStateFlow(false)
    val isFollowed: StateFlow<Boolean> = _isFollowed.asStateFlow()

    val playlists: StateFlow<List<com.example.musicflow.data.local.PlaylistEntity>> = repository.getPlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun loadArtist(idOrName: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                _isFollowed.value = repository.isArtistFollowed(idOrName)
                
                var artistResult = repository.getArtistDetails(idOrName)
                var songsResult = artistResult?.topSongs?.ifEmpty { null } ?: repository.getArtistSongs(idOrName)
                var albumsResult = artistResult?.topAlbums?.ifEmpty { null } ?: repository.getArtistAlbums(idOrName)

                // If artistResult was not found or idOrName is numeric, perform intelligent resolution
                if (artistResult == null || songsResult.isEmpty() || artistResult.name.all { it.isDigit() }) {
                    val searchArtists = repository.searchArtists(idOrName)
                    val matchedArtist = searchArtists.firstOrNull()
                    if (matchedArtist != null && matchedArtist.id != idOrName) {
                        val details = repository.getArtistDetails(matchedArtist.id) ?: matchedArtist
                        artistResult = details
                        if (songsResult.isEmpty()) {
                            songsResult = details.topSongs.ifEmpty { repository.getArtistSongs(matchedArtist.id) }
                        }
                        if (albumsResult.isEmpty()) {
                            albumsResult = details.topAlbums.ifEmpty { repository.getArtistAlbums(matchedArtist.id) }
                        }
                    }
                    
                    if (songsResult.isEmpty()) {
                        val searchedSongs = repository.searchSongs(idOrName, limit = 30)
                        if (searchedSongs.isNotEmpty()) {
                            songsResult = searchedSongs
                        }
                    }
                }

                // Extract authentic artist name if it was just numeric ID or missing
                val extractedName = if (artistResult == null || artistResult.name.isBlank() || artistResult.name.all { it.isDigit() }) {
                    songsResult.firstOrNull()?.artists?.split(",", "&", "feat.", "ft.")?.firstOrNull()?.trim() ?: idOrName
                } else {
                    artistResult.name
                }

                val extractedImage = if (artistResult?.image.isNullOrBlank()) {
                    songsResult.firstOrNull { it.image.isNotBlank() }?.image ?: ""
                } else {
                    artistResult!!.image
                }

                artistResult = Artist(
                    id = artistResult?.id ?: idOrName,
                    name = extractedName,
                    image = extractedImage,
                    role = artistResult?.role ?: "Artist"
                )

                _artist.value = artistResult
                _topSongs.value = songsResult
                _albums.value = albumsResult
            } catch (e: Exception) {
                try {
                    val searchedSongs = repository.searchSongs(idOrName, limit = 25)
                    val extractedName = searchedSongs.firstOrNull()?.artists?.split(",", "&", "feat.")?.firstOrNull()?.trim() ?: idOrName
                    val topImage = searchedSongs.firstOrNull()?.image ?: ""
                    _artist.value = Artist(id = idOrName, name = extractedName, image = topImage)
                    _topSongs.value = searchedSongs
                } catch (ex: Exception) {
                    _artist.value = Artist(id = idOrName, name = idOrName, image = "")
                }
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun startArtistRadio() {
        viewModelScope.launch {
            val songs = _topSongs.value
            val currentArtist = _artist.value
            if (songs.isNotEmpty()) {
                val queue = songs.filter { it.streamUrl.isNotBlank() }
                if (queue.isNotEmpty()) {
                    musicController.playQueue(queue, 0)
                } else {
                    playSong(songs.first())
                }
            } else if (currentArtist != null && currentArtist.name.isNotBlank()) {
                val searched = repository.searchComprehensiveSongs(currentArtist.name)
                if (searched.isNotEmpty()) {
                    musicController.playQueue(searched, 0)
                }
            }
        }
    }

    fun toggleFollow() {
        viewModelScope.launch {
            _artist.value?.let { artist ->
                repository.toggleFollowArtist(artist)
                _isFollowed.value = repository.isArtistFollowed(artist.id)
            }
        }
    }

    fun playSong(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.playSong(fullSong)
        }
    }

    fun playArtistTopSongs() {
        viewModelScope.launch {
            if (_topSongs.value.isNotEmpty()) {
                val firstSong = _topSongs.value.first()
                val fullFirstSong = if (firstSong.streamUrl.isNotBlank()) firstSong else repository.getSongDetails(firstSong.id) ?: firstSong
                if (fullFirstSong.streamUrl.isNotBlank()) {
                    musicController.playSong(fullFirstSong)
                }
            }
        }
    }

    fun playNext(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.playNext(fullSong)
        }
    }

    fun addToQueue(song: Song) {
        viewModelScope.launch {
            val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
            musicController.addToQueue(fullSong)
        }
    }

    fun startRadio(song: Song) {
        viewModelScope.launch {
            try {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                val artistQuery = fullSong.artists.split(",", "&", "feat.", "ft.").firstOrNull()?.trim()?.takeIf { it.isNotBlank() && it != "Unknown Artist" }
                val related = if (!artistQuery.isNullOrBlank()) {
                    repository.searchComprehensiveSongs(artistQuery)
                } else {
                    repository.searchComprehensiveSongs(fullSong.name)
                }
                val validRelated = related.filter { it.id != fullSong.id && it.streamUrl.isNotBlank() }
                val queue = (listOf(fullSong) + validRelated).distinctBy { it.id }

                val isCurrent = musicController.currentSong.value?.id == fullSong.id
                if (isCurrent && musicController.isPlaying.value) {
                    musicController.setRadioQueueKeepPlaying(queue)
                } else {
                    musicController.playQueue(queue, 0)
                }
            } catch (e: Exception) {
                val fullSong = if (song.streamUrl.isNotBlank()) song else repository.getSongDetails(song.id) ?: song
                musicController.playSong(fullSong)
            }
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            repository.toggleFavorite(song)
        }
    }

    fun addToPlaylist(playlistId: String, song: Song) {
        viewModelScope.launch {
            repository.addSongToPlaylist(playlistId, song)
        }
    }

    fun createPlaylist(name: String) {
        viewModelScope.launch {
            val id = System.currentTimeMillis().toString()
            repository.addPlaylist(com.example.musicflow.data.local.PlaylistEntity(id, name, "", ""))
        }
    }
}
