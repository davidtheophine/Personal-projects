package persistence;

import org.json.JSONObject;

public interface Writable {
    // EFFECT: returns a JSON object
    JSONObject toJson(); 
} 




