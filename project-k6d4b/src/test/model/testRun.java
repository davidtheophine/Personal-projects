package model;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class testRun {
    private Run runTester;
    
    @BeforeEach
    void runBefore() {
        runTester = new Run("Sunday 10K", 10.00, 4.30, LocalDate.of(2024, 05, 23), "Park", true);


    }

    @Test
    void testConstructor() {
        assertEquals("Sunday 10K", runTester.getTitle());
        assertEquals(10.00, runTester.getDistance());
        assertEquals(4.30, runTester.getPace());
        assertEquals(LocalDate.of(2024, 05, 23), runTester.getDate());
        assertEquals("Park", runTester.getLocation());
        assertTrue(runTester.getStatus());
    }

    @Test
    void testSetTitle(){
        runTester.setTitle("Monday 10K");
        assertEquals("Monday 10K", runTester.getTitle());
    }

    @Test
    void testSetDistance(){
        runTester.setDistance(10.50);
        assertEquals(10.50, runTester.getDistance());
    }

    @Test
    void testSetPace(){
        runTester.setPace(5.00);
        assertEquals(5.00, runTester.getPace());
    }

    @Test
    void testSetDate(){
        runTester.setDate("2024-05-30");
        assertEquals(LocalDate.parse("2024-05-30", DateTimeFormatter.ISO_DATE), runTester.getDate());
    }

    @Test
    void testSetLocation(){
        runTester.setLocation("Track");
        assertEquals("Track", runTester.getLocation());
    }

    @Test
    void testSetTrue() {
        runTester.setTrue();
        assertTrue(runTester.getStatus());
    }

    @Test
    void testSetFalse() {
        runTester.setFalse();
        assertFalse(runTester.getStatus());
    }

    @Test
    void testToJson() {
        JSONObject jsonRun = runTester.toJson();
        assertEquals("Sunday 10K", jsonRun.getString("title"));
        assertEquals(10, jsonRun.getDouble("distance"), 0.01);
        assertEquals(4.30, jsonRun.getDouble("pace"), 0.01);
        assertEquals(runTester.getDate(), LocalDate.parse(jsonRun.get("date").toString()));
        assertEquals("Park", jsonRun.getString("location"));
        assertTrue(jsonRun.getBoolean("status"));
    }
}
