package ui;
import model.Run;
import persistence.JsonReader;
import persistence.JsonWriter;
import model.Challenge;

import java.util.ArrayList;
import java.util.List;

import java.util.Scanner;
import java.time.format.DateTimeFormatter;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.time.LocalDate;


// Runbud application
public class Runbud {
    private static final String JSON_STATE = "./data/state.json";
    List<Run> runList;
    Challenge challenge;
    private Scanner input;
    private JsonWriter jsonWriter;
    private JsonReader jsonReader;

    // runs the application
    public Runbud() throws FileNotFoundException {
        //input = new Scanner(System.in);
        runList = new ArrayList<>();
        challenge = new Challenge();
        jsonWriter = new JsonWriter(JSON_STATE);
        jsonReader = new JsonReader(JSON_STATE);
        //runApp();
    }

    // MODIFIES: this, runlist
    // EFFECTS: logs a run into the app
    public void logRun(String title, Double distance, Double pace, String date, String location, boolean status) {
        Run run = new Run(title, distance, pace, LocalDate.parse(date, DateTimeFormatter.ISO_DATE), location, status);
        runList.add(run);
    }
    
    // MODIFIES: this, challenge
    // EFFECTS: logs a run into a new challenge
    public void beginChallenge(String title, Double distance, Double pace, String date, String location, boolean status) {
        Run challengeRun = new Run(title, distance, pace, LocalDate.parse(date, DateTimeFormatter.ISO_DATE), location, status);
        challenge.addRun(challengeRun);
    }

    // EFFECTS: displays run data aggregates
    public String showAggregate() {
        double totalDistance = 0;
        double totalPace = 0;
        int count = 0;
        for (Run run: runList) {
            if (run.getStatus()) {
                totalDistance += run.getDistance();
                totalPace += run.getPace();
                count++;
            }
        }
        if (count > 0) {
            double avgDistance = totalDistance / count;
            double avgPace = totalPace / count;
            return "Total distance: " + totalDistance + "\nAverage distance: " + avgDistance + "\nAverage pace: " + avgPace;
        } else {
            return "Start running! You currently have no run data to aggregate";
        }
    }

    // EFFECTS: displays runs in challenge
    public String viewChallenge() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < challenge.getChallenge().size(); i++) {
            Run run = challenge.getChallenge().get(i);
            sb.append("Run " + (i + 1) + ":");
            sb.append("\nTitle: " + run.getTitle());
            sb.append("\nDistance: " + run.getDistance());
            sb.append("\nPace: " + run.getPace());
            sb.append("\nDate: " + run.getDate());
            sb.append("\nLocation: " + run.getLocation());
            sb.append("\nStatus: " + (run.getStatus()? "Completed" : "Not completed"));
            sb.append("\n\n");
        }
        return sb.toString();
    }
    // MODIFIES: thix, challenge
    // EFFECTS: logs a run into a new challenge
    public void changeStatus(int no) {
        challenge.statusChange(no-1);
    }

    //EFFECTS: saves state of the app
    public void saveState() {
        try {
            jsonWriter.open();
            jsonWriter.write(runList,challenge);
            // jsonWriter.write(challenge.getChallenge());
            jsonWriter.close();
            System.out.println("Saved state challenge to " + JSON_STATE);
        } catch (FileNotFoundException e) {
            System.out.println("Unable to write to file: " + JSON_STATE);
        }
        
    }

    //EFFECTS: loads previous state of the app
    public void loadState() {
        try {
            runList = jsonReader.readLoggedRuns();
            challenge = jsonReader.readChallengeRuns();
            System.out.println("Loaded challenge from " + JSON_STATE);
        } catch (IOException e) {
            System.out.println("Unable to read from file: " + JSON_STATE);
        }
    }


}
