package model;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.Arrays;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class testChallenge {
    private Challenge challengeTester;
    private Run run1;
    private Run run2;
    private Run run3;


    @BeforeEach
    void runBefore() {
        challengeTester = new Challenge();
        run1 =new Run("Friday 5K", 5.00, 3.50, 
                    LocalDate.of(2024, 07, 17), "Park",true);
        run2 =new Run("Thursday 5K", 5.00, 4.45, 
                    LocalDate.of(2024, 07, 20), "Park",false);
        run3 =new Run("Saturday 10", 10.25, 4.30, 
                    LocalDate.of(2024, 9, 20), "Track",true);
    }

    @Test
    void testAddRun() {
        challengeTester.addRun(run1);
        assertEquals(challengeTester.challengeList.get(0), run1);

        challengeTester.addRun(run2);
        assertEquals(challengeTester.challengeList.get(1), run2);
    }

    @Test
    void testStausChange() {
        challengeTester.addRun(run1);
        challengeTester.addRun(run2);
        challengeTester.statusChange(1);
        assertTrue(run2.getStatus());
        challengeTester.statusChange(1);
        assertFalse(run2.getStatus());


    }

    @Test
    void testViewChallenge() {
        challengeTester.addRun(run1);
        challengeTester.addRun(run2);
        challengeTester.addRun(run3);
        assertEquals(Arrays.asList(run1, run2, run3), challengeTester.getChallenge());

    }

    @Test 
    public void testRunsToJson() {
        challengeTester.addRun(run1);
        challengeTester.addRun(run2);
        //challengeTester.addRun(run3);
        JSONArray jsonArray = challengeTester.runsToJson();
        assertEquals(2, jsonArray.length());

        JSONObject jsonRun1 = jsonArray.getJSONObject(0);
        assertEquals("Friday 5K", jsonRun1.getString("title"));
        assertEquals(5, jsonRun1.getDouble("distance"));
        assertEquals(3.50, jsonRun1.getDouble("pace"));
        assertEquals(run1.getDate(), LocalDate.parse(jsonRun1.get("date").toString()));
        assertEquals("Park", jsonRun1.getString("location"));
        assertTrue(jsonRun1.getBoolean("status"));

        JSONObject jsonRun2 = jsonArray.getJSONObject(1);
        assertEquals("Thursday 5K", jsonRun2.getString("title"));
        assertEquals(5, jsonRun2.getDouble("distance"));
        assertEquals(4.45, jsonRun2.getDouble("pace"));
        assertEquals(run1.getDate(), LocalDate.parse(jsonRun1.get("date").toString()));
        assertEquals("Park", jsonRun2.getString("location"));
        assertFalse(jsonRun2.getBoolean("status"));
        
    }




}
