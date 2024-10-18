package model;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.json.JSONObject;

import persistence.Writable;

// represents a run with a title, distance, pace, date, location and status
public class Run implements Writable {
    private String runTitle;
    private double runDistance;
    private double runPace;
    private LocalDate runDate;
    private String runLocation;
    private boolean runStatus;

    /*
     * REQUIRES: distance and pace have a non-zero length
     * EFFECTS: title on run is set to runTitle; distance and pace is a
     * positive double; date is in Localdate, location of run is set to runLocation
     * 
     */
    public Run(String title, double distance, double pace, LocalDate date, String location, boolean status) {
        runTitle = title;
        // if (distance >= 0) {
        // runDistance = distance;
        // } else {
        // runDistance = 0.00;
        // }
        runDistance = distance;

        runPace = pace;
        // if (pace >= 0) {
        // runPace = pace;
        // } else {
        // runPace = 0.00;
        // }
        runDate = date;
        runLocation = location;
        runStatus = status;
        EventLog.getInstance().logEvent(new Event("Run logged: " + title));
    }

    // EFFECTS: sets title to runTitle
    public void setTitle(String title) {
        runTitle = title;
    }

    // EFFECTS: sets distance to runDistance
    public void setDistance(double distance) {
        runDistance = distance;
    }

    // EFFECTS: sets pace to runPace
    public void setPace(double pace) {
        runPace = pace;
    }

    // EFFECTS: sets date to runDate
    public void setDate(String strDate) {
        runDate = LocalDate.parse(strDate, DateTimeFormatter.ISO_DATE);
    }

    // EFFECTS: sets location to runLocation
    public void setLocation(String location) {
        runLocation = location;
    }

    // EFFECTS: sets runStatus to true
    public void setTrue() {
        runStatus = true;
        EventLog.getInstance().logEvent(new Event("Run status changed: " + getTitle()));

    }

    // EFFECTS: sets runStatus to false
    public void setFalse() {
        runStatus = false;
        EventLog.getInstance().logEvent(new Event("Run status changed: " + getTitle()));
    }

    // EFFECTS: gets the title
    public String getTitle() {
        return runTitle;
    }

    // EFFECTS: gets the distance
    public double getDistance() {
        return runDistance;
    }

    // EFFECTS: gets the pace
    public double getPace() {
        return runPace;
    }

    // EFFECTS: gets the date
    public LocalDate getDate() {
        return runDate;
    }

    // EFFECTS: gets the location
    public String getLocation() {
        return runLocation;
    }

    // EFFECTS: gets the status
    public boolean getStatus() {
        return runStatus;
    }

    @Override
    public JSONObject toJson() {
        JSONObject json = new JSONObject();
        json.put("title", runTitle);
        json.put("distance", runDistance);
        json.put("pace", runPace);
        json.put("date", runDate);
        json.put("location", runLocation);
        json.put("status", runStatus);
        return json;
    }

    // @Override
    // public void printEventLog() {
    //     EventLog eventLog = EventLog.getInstance();
    //     for (Event event : eventLog) {
    //         System.out.println(event.toString());
    //     }
    // }

}
