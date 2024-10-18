package persistence;

import model.Challenge;
import model.Run;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
public class JsonReaderTest {
    private JsonReader reader;

    @BeforeEach
    void runBefore() {
        reader = new JsonReader("./data/testRead.json");
    }

    @Test
    void testReadNonExistent() {
        JsonReader reader = new JsonReader("./data/nonExistent.json");
        try {
            reader.readLoggedRuns();
            fail("Expected IOException");
        } catch (IOException e) {
            // expected
        }
    }

    @Test
    void testReadLogged() {
        try {
            List<Run> loggedRuns = reader.readLoggedRuns();
            assertEquals(2, loggedRuns.size());
            Run run1 = loggedRuns.get(0);
            assertEquals("Run 1", run1.getTitle());
            assertEquals(5, run1.getDistance(), 0.01);
            assertEquals(30, run1.getPace(), 0.01);
            assertEquals(LocalDate.of(2022, 1, 1), run1.getDate());
            assertEquals("Location 1", run1.getLocation());
            assertTrue(run1.getStatus());

            Run run2 = loggedRuns.get(1);
            assertEquals("Run 2", run2.getTitle());
            assertEquals(3, run2.getDistance(), 0.01);
            assertEquals(20, run2.getPace(), 0.01);
            assertEquals(LocalDate.of(2022, 1, 2), run2.getDate());
            assertEquals("Location 2", run2.getLocation());
            assertFalse(run2.getStatus());
        } catch (IOException e) {
            fail("Unexpected IO exception");
        }
    }

    @Test
    void testReadChallenge() {
        try {
            Challenge challenge = reader.readChallengeRuns();
            assertEquals(2, challenge.getChallenge().size());

            Run run1 = challenge.getChallenge().get(0);
            assertEquals("Challenge Run 1", run1.getTitle());
            assertEquals(4, run1.getDistance(), 0.01);
            assertEquals(25, run1.getPace(), 0.01);
            assertEquals(LocalDate.of(2022, 1, 3), run1.getDate());
            assertEquals("Location 3", run1.getLocation());
            assertTrue(run1.getStatus());

            Run run2 = challenge.getChallenge().get(1);
            assertEquals("Challenge Run 2", run2.getTitle());
            assertEquals(6, run2.getDistance(), 0.01);
            assertEquals(35, run2.getPace(), 0.01);
            assertEquals(LocalDate.of(2022, 1, 4), run2.getDate());
            assertEquals("Location 4", run2.getLocation());
            assertFalse(run2.getStatus());
        } catch (IOException e) {
            fail("Unexpected IO exception");
        }
    }

}
