package model;

import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;

// represents a list of runs
public class Challenge {
    List<Run> challengeList;

    public Challenge() {
        this.challengeList = new ArrayList<>();
    }

    // MODIFIES: this
    // EFFECTS: adds run to challenge
    public void addRun(Run run) {
        // run.setFalse();
        challengeList.add(run);
        EventLog.getInstance().logEvent(new Event("Run added to challenge: " + run.getTitle()));
    }

    // EFFECTS: marks run in challenge as completed
    public void statusChange(int index) {
        if (index >= 0 && index < challengeList.size()) {
            Run currentRun = challengeList.get(index);
            if (currentRun.getStatus()) {
                currentRun.setFalse();
            } else {
                currentRun.setTrue();
            }
            EventLog.getInstance().logEvent(new Event("Run status changed in challenge: " + currentRun.getTitle()));
        }

    }

    // EFFECTS: returns challenge list
    public List<Run> getChallenge() {
        return challengeList;
    }

    // EFFECTS: returns runs in challenge as a JSON array
    public JSONArray runsToJson() {
        JSONArray jsonArray = new JSONArray();

        for (Run r : challengeList) {
            jsonArray.put(r.toJson());
        }

        return jsonArray;
    }

}
