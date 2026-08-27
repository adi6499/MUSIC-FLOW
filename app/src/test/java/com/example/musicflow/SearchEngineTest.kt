package com.example.musicflow

import com.example.musicflow.data.model.Song
import com.example.musicflow.data.search.QueryNormalizer
import com.example.musicflow.data.search.SearchEngine
import com.example.musicflow.data.search.StringSimilarity
import com.example.musicflow.data.search.TrackDeduplicator
import org.junit.Assert.*
import org.junit.Test

class SearchEngineTest {

    private fun createSong(
        id: String,
        name: String,
        artists: String,
        album: String = "Album",
        streamUrl: String = "http://stream.url",
        duration: Int = 200,
        hasLyrics: Boolean = true
    ) = Song(
        id = id,
        name = name,
        artists = artists,
        album = album,
        duration = duration,
        image = "https://example.com/500x500/cover.jpg",
        streamUrl = streamUrl,
        downloadUrls = emptyList(),
        year = "2020",
        language = "English",
        hasLyrics = hasLyrics
    )

    @Test
    fun `QueryNormalizer normalizes unicode, special punctuation, and case`() {
        assertEquals("blinding lights", QueryNormalizer.normalize("  Blinding   Lights  "))
        assertEquals("blinding lights", QueryNormalizer.normalize("BLINDING-LIGHTS"))
        assertEquals("ac dc", QueryNormalizer.normalize("AC/DC"))
        assertEquals("guns n' roses", QueryNormalizer.normalize("Guns N’ Roses"))
        assertEquals("taylor swift love story", QueryNormalizer.normalize("Taylor Swift – Love Story"))
        assertEquals("beyonce", QueryNormalizer.normalize("Beyoncé"))
    }

    @Test
    fun `QueryNormalizer parses compound artist and song queries`() {
        val q1 = QueryNormalizer.parseCompoundQuery("Blinding Lights Weeknd")
        assertTrue(q1.isCompoundQuery)
        assertEquals("blinding lights", q1.candidateSongTitle)
        assertEquals("weeknd", q1.candidateArtist)

        val q2 = QueryNormalizer.parseCompoundQuery("The Weeknd Blinding Lights")
        assertTrue(q2.isCompoundQuery)
        assertEquals("the weeknd", q2.candidateArtist)
        assertEquals("blinding lights", q2.candidateSongTitle)

        val q3 = QueryNormalizer.parseCompoundQuery("Arijit Singh Tum Hi Ho")
        assertTrue(q3.isCompoundQuery)
        assertEquals("arijit singh", q3.candidateArtist)
        assertEquals("tum hi ho", q3.candidateSongTitle)

        val q4 = QueryNormalizer.parseCompoundQuery("Ed Sheeran - Shape of You")
        assertTrue(q4.isCompoundQuery)
        assertEquals("ed sheeran", q4.candidateArtist)
        assertEquals("shape of you", q4.candidateSongTitle)
    }

    @Test
    fun `SearchEngine ranks exact song match at top position`() {
        val song1 = createSong("1", "Blinding Lights", "The Weeknd")
        val song2 = createSong("2", "Blinding", "Various Artists")
        val song3 = createSong("3", "Lights", "Ellie Goulding")
        val song4 = createSong("4", "Blinding Lights (Karaoke Version)", "The Hit Crew")

        val candidates = listOf(song4, song3, song2, song1)
        val parsed = QueryNormalizer.parseCompoundQuery("Blinding Lights")

        val ranked = SearchEngine.rankSongs(candidates, parsed)

        assertEquals("1", ranked[0].id)
        assertEquals("Blinding Lights", ranked[0].name)
        assertEquals("The Weeknd", ranked[0].artists)
    }

    @Test
    fun `SearchEngine handles typo queries accurately`() {
        val target = createSong("1", "Blinding Lights", "The Weeknd")
        val unrelated = createSong("2", "Light It Up", "Major Lazer")

        val parsedTypo1 = QueryNormalizer.parseCompoundQuery("blinding lites")
        val ranked1 = SearchEngine.rankSongs(listOf(unrelated, target), parsedTypo1)
        assertEquals("1", ranked1[0].id)

        val parsedTypo2 = QueryNormalizer.parseCompoundQuery("blinding ligt")
        val ranked2 = SearchEngine.rankSongs(listOf(unrelated, target), parsedTypo2)
        assertEquals("1", ranked2[0].id)

        // Indian transliteration typo: "arjit sing tum hi ho"
        val tumHiHo = createSong("3", "Tum Hi Ho", "Arijit Singh")
        val otherSong = createSong("4", "Sunn Raha Hai", "Ankit Tiwari")
        val parsedTypo3 = QueryNormalizer.parseCompoundQuery("arjit sing tum hi ho")
        val ranked3 = SearchEngine.rankSongs(listOf(otherSong, tumHiHo), parsedTypo3)
        assertEquals("3", ranked3[0].id)

        // "shape of yu"
        val shapeOfYou = createSong("5", "Shape of You", "Ed Sheeran")
        val parsedTypo4 = QueryNormalizer.parseCompoundQuery("shape of yu")
        val ranked4 = SearchEngine.rankSongs(listOf(otherSong, shapeOfYou), parsedTypo4)
        assertEquals("5", ranked4[0].id)
    }

    @Test
    fun `SearchEngine handles partial queries`() {
        val song = createSong("1", "Blinding Lights", "The Weeknd")
        val other = createSong("2", "Unrelated Track", "Unknown")

        val parsed = QueryNormalizer.parseCompoundQuery("blind")
        val ranked = SearchEngine.rankSongs(listOf(other, song), parsed)
        assertEquals("1", ranked[0].id)
    }

    @Test
    fun `SearchEngine demotes karaoke, cover, and slowed reverb tracks`() {
        val original = createSong("1", "Starboy", "The Weeknd")
        val karaoke = createSong("2", "Starboy (Karaoke Version)", "The Weeknd")
        val cover = createSong("3", "Starboy (Tribute Cover)", "Various Artists")
        val slowed = createSong("4", "Starboy [Slowed + Reverb]", "DJ Mix")

        val candidates = listOf(karaoke, cover, slowed, original)
        val parsed = QueryNormalizer.parseCompoundQuery("Starboy")

        val ranked = SearchEngine.rankSongs(candidates, parsed)

        assertEquals("1", ranked[0].id)
        assertEquals("Starboy", ranked[0].name)
    }

    @Test
    fun `TrackDeduplicator clusters duplicate tracks and keeps canonical quality version`() {
        val lowQuality = createSong("1", "Blinding Lights", "The Weeknd", streamUrl = "", duration = 0)
        val studioHigh = createSong("2", "Blinding Lights", "The Weeknd", album = "After Hours", streamUrl = "http://high.res", duration = 200)
        val compilation = createSong("3", "Blinding Lights", "The Weeknd", album = "Top Hits Compilation", streamUrl = "http://med.res", duration = 200)

        val deduplicated = TrackDeduplicator.deduplicate(listOf(lowQuality, studioHigh, compilation))

        assertEquals(1, deduplicated.size)
        assertEquals("2", deduplicated[0].id)
        assertEquals("After Hours", deduplicated[0].album)
    }

    @Test
    fun `SearchEngine detects DidYouMean suggestions`() {
        val suggestion1 = SearchEngine.detectDidYouMean("weeknd")
        assertEquals("The Weeknd", suggestion1)

        val suggestion2 = SearchEngine.detectDidYouMean("arjit singh")
        assertEquals("Arijit Singh", suggestion2)

        val suggestion3 = SearchEngine.detectDidYouMean("tayler swift")
        assertEquals("Taylor Swift", suggestion3)
    }

    @Test
    fun `StringSimilarity computes high similarity on phonetic transliterations`() {
        val sim1 = StringSimilarity.computeMatchScore("arjit sing", "arijit singh")
        assertTrue("Expected score >= 0.85, got $sim1", sim1 >= 0.85)

        val sim2 = StringSimilarity.computeMatchScore("blinding lites", "blinding lights")
        assertTrue("Expected score >= 0.85, got $sim2", sim2 >= 0.85)

        val sim3 = StringSimilarity.computeMatchScore("shape of yu", "shape of you")
        assertTrue("Expected score >= 0.85, got $sim3", sim3 >= 0.85)
    }
}
