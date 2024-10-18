package ui;

import javax.swing.*;

import model.EventLog;
import model.EventLogDisplay;

import java.awt.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.FileNotFoundException;

public class Main {
    public static void main(String[] args) {
        try {
            JFrame frame = new JFrame("Runbud");
            frame.setDefaultCloseOperation(JFrame.DO_NOTHING_ON_CLOSE);
            frame.addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosing(WindowEvent e) {
                    // EventLog eventLog = EventLog.getInstance();
                    // for (model.Event event : eventLog) {
                    //     System.out.println(event.getDescription());
                    // }
                    EventLogDisplay eventLogModel = new EventLogDisplay();
                    eventLogModel.printEventLog();
                    eventLogModel.clear();
                    System.exit(0);
                }
            });
            frame.add(new RunbudGUI());
            //frame.setSize(700,600);
            frame.pack();
            frame.setBackground(Color.black);
            frame.setVisible(true);

        } catch (FileNotFoundException e) {
            e.printStackTrace(); 
        }
    }
}


