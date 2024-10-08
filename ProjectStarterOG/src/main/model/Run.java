package model;

public class Run {
    private int runDistance;
    private int runDate;
    private float runPace;
    private String runLocation;
    private String runSurface;
    private boolean runStatus;

    public Run(int date, int distance, int pace) {
        runDate = date;
        runDistance = distance;
        runPace = pace;
        runStatus = false;  
    }

    //getters
    public int getDistance() {
        return runDistance;
    }

    public int getDate() {
        return runDistance;
    }

    public float getPace() {
        return runDistance;
    }

}
