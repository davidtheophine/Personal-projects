package persistence;

import model.Run;
import model.Challenge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.json.*;

// citation: JsonSerializationDemo program provided as a guide
// Represents a reader that reads challenge from the JSON data
public class JsonReader {
    private String source;

    // EFFECTS: constructs a reader to read from the source file
    public JsonReader(String source) {
        this.source = source;
    }

    public List<Run> readLoggedRuns() throws IOException {
        String jsonData = readFile(source);
        JSONObject jsonObject = new JSONObject(jsonData);
        return parseLoggedRuns(jsonObject);
    }

    public Challenge readChallengeRuns() throws IOException {
        String jsonData = readFile(source);
        JSONObject jsonObject = new JSONObject(jsonData);
        return parseChallengeRuns(jsonObject);
    }

    // EFFECTS: reads source file as string and returns it
    private String readFile(String source) throws IOException {
        StringBuilder contentBuilder = new StringBuilder();

        try (Stream<String> stream = Files.lines(Paths.get(source), StandardCharsets.UTF_8)) {
            stream.forEach(s -> contentBuilder.append(s));
        }

        return contentBuilder.toString();
    }

    private List<Run> parseLoggedRuns(JSONObject jsonObject) {
        List<Run> runList = new ArrayList<>();
        JSONArray loggedRunsArray = jsonObject.getJSONArray("logged runs");
        for (Object json : loggedRunsArray) {
            JSONObject nextRun = (JSONObject) json;
            logAddRun(runList, nextRun);
        }
        return runList;
    }

    // EFFECTS: parses challenge from JSON object and returns it
    private Challenge parseChallengeRuns(JSONObject jsonObject) {
        Challenge ch = new Challenge();
        JSONArray challengeRunsArray = jsonObject.getJSONArray("challenge runs");
        for (Object json : challengeRunsArray) {
            JSONObject nextRun = (JSONObject) json;
            challengeAddRun(ch, nextRun);
        }
        return ch;
    }

    private void logAddRun(List<Run> runList, JSONObject jsonObject) {
        String title = jsonObject.getString("title");
        double distance = jsonObject.getDouble("distance");
        double pace = jsonObject.getDouble("pace");
        String dateStr = jsonObject.getString("date");
        LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_DATE);
        String location = jsonObject.getString("location");
        boolean status = jsonObject.getBoolean("status");
        //boolean status = Boolean.parseBoolean(statusStr);
        Run run = new Run(title, distance, pace, date, location, status);
        runList.add(run);
    }

    private void challengeAddRun(Challenge ch, JSONObject jsonObject) {
        String title = jsonObject.getString("title");
        double distance = jsonObject.getDouble("distance");
        double pace = jsonObject.getDouble("pace");
        String dateStr = jsonObject.getString("date");
        LocalDate date = LocalDate.parse(dateStr, DateTimeFormatter.ISO_DATE);
        String location = jsonObject.getString("location");
        boolean status = jsonObject.getBoolean("status");
        // boolean status = Boolean.parseBoolean(statusStr);
        Run run = new Run(title, distance, pace, date, location, status);
        ch.addRun(run);
    }
}
