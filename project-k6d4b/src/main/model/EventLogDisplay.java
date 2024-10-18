package model;

public class EventLogDisplay {  
    private EventLog eventLog = EventLog.getInstance();

    public void printEventLog() {
        for (Event event : eventLog) {
            System.out.println(event.getDescription());
        }
    }

    public void clear() {
        eventLog.clear();
        eventLog.logEvent(new Event("Event log cleared."));
    }

}
