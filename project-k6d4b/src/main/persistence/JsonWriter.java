package persistence;

import model.Challenge;
import model.Run;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;



public class JsonWriter {
    private static final int Spacing = 4;
    private PrintWriter writer;
    private String destination;

    // citation: JsonSerializationDemo program provided as a guide
    // EFFECTS: constructs writer to write to destination file
    public JsonWriter(String destination) {
        this.destination = destination;
    }

    // MODIFIES: this
    // EFFECTS: opens writer; throws FileNotFoundException if destination file cannot
    // be opened for writing
    public void open() throws FileNotFoundException {
        writer = new PrintWriter(new File(destination));
    }

    // MODIFIES: this
    // EFFECTS: writes JSON representation of workroom to file
    public void write(List<Run> runList, Challenge ch) {
        JSONObject jsonData = new JSONObject(); // object
        JSONArray runsArray = new JSONArray();  // runlist arrray
        for (Run run : runList) {
            runsArray.put(run.toJson());
        }
        jsonData.put("logged runs", runsArray);
        jsonData.put("challenge runs", ch.runsToJson());
        saveToFile(jsonData.toString(Spacing));

    }

    // MODIFIES: this
    // EFFECTS: closes writer
    public void close() {
        writer.close();
    }

    // MODIFIES: this
    // EFFECTS: writes string to file
    private void saveToFile(String json) {
        writer.print(json);
    }


}
