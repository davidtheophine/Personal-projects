package persistence;

import model.Challenge;
import model.Run;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class JsonWriterTest {

    @Test
    void testWriteFile() {
        List<Run> runList = new ArrayList<>();
        runList.add(new Run("Run 1", 5.0, 30, LocalDate.parse("2022-01-01"), "Location 1",true));
        runList.add(new Run("Run 2", 3.0, 20, LocalDate.parse("2022-01-02"), "Location 2",false));
        Challenge challenge = new Challenge();
        challenge.addRun(new Run("Challenge Run 1", 4.0, 25, LocalDate.parse("2022-01-03"), "Location 3",true));
        challenge.addRun(new Run("Challenge Run 2", 6.0, 35, LocalDate.parse("2022-01-04"), "Location 4",false));

        JsonWriter writer = new JsonWriter("./data/testWrite.json");
        try {
            writer.open();
            writer.write(runList, challenge);
            writer.close();

            File file = new File("./data/testWrite.json");
            assertTrue(file.exists());
        } catch (IOException e) {
            fail("Unexpected IO exception");
        }

    }

}
