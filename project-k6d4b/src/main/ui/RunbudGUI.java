package ui;

import javax.swing.*;

import model.EventLog;
import model.EventLogDisplay;

import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.FileNotFoundException;

// represents the GUI for the program
public class RunbudGUI extends JPanel {
    private Runbud runbud;
    private JTextField titleField;
    private JTextField distanceField;
    private JTextField paceField;
    private JTextField dateField;
    private JTextField locationField;
    private JTextField statusField;
    private JTextArea display;
    private JLabel imageLabel;
    //private EventLog eventLog;
    private EventLogDisplay eventLogDisplay;

    // MODIFIES: this
    // EFFECTS: Lays out GUI components and initializes fields
    public RunbudGUI() throws FileNotFoundException {
        runbud = new Runbud();
        //eventLog = EventLog.getInstance();
        eventLogDisplay = new EventLogDisplay();
        setLayout(new BorderLayout());
        JPanel inputPanel = createInputPanel();
        JPanel buttonRow = createButtonRow();
        createDisplay();
        addComponent(inputPanel, buttonRow);
    }

    //  EFFECTS: Creates and returns new JPanel with input fields and labels
    private JPanel createInputPanel() {
        JPanel inputPanel = new JPanel();
        inputPanel.setBackground(Color.lightGray);
        inputPanel.setLayout(new GridLayout(0, 2));
        inputPanel.add(new JLabel("Title: "));
        titleField = new JTextField();
        inputPanel.add(titleField);
        inputPanel.add(new JLabel("Distance: "));
        distanceField = new JTextField();
        inputPanel.add(distanceField);
        inputPanel.add(new JLabel("Pace: "));
        paceField = new JTextField();
        inputPanel.add(paceField);
        inputPanel.add(new JLabel("Date (YYYY-MM-DD): "));
        dateField = new JTextField();
        inputPanel.add(dateField);
        inputPanel.add(new JLabel("Location: "));
        locationField = new JTextField();
        inputPanel.add(locationField);
        inputPanel.add(new JLabel("Staus(true/false): "));
        statusField = new JTextField();
        inputPanel.add(statusField);

        return inputPanel;
    }

    //  EFFECTS: Creates and returns new JPanel with buttons and listeners
    private JPanel createButtonRow() {
        // Buttons with listeners
        JPanel buttonPanel = new JPanel();
        //buttonPanel.setBackground(Color.DARK_GRAY);

        JButton logButton = new JButton("Log Run");
        logButton.addActionListener(new LogListener());
        buttonPanel.add(logButton);
        
        JButton challengeButton = new JButton("Begin/Add to Challenge");
        challengeButton.addActionListener(new ChallengeListener());
        buttonPanel.add(challengeButton);

        JButton viewButton = new JButton("View Challenge");
        viewButton.addActionListener(new ViewListener());
        buttonPanel.add(viewButton);

        JButton statusChangeButton = new JButton("Change Run Status");
        statusChangeButton.addActionListener(new StatusListener());
        buttonPanel.add(statusChangeButton);

        JButton aggregateButton = new JButton("Aggregate Logged runs");
        aggregateButton.addActionListener(new AggregateListener());
        buttonPanel.add(aggregateButton);

        JButton saveButton = new JButton("Save runbud state");
        saveButton.addActionListener(new SaveListener());
        buttonPanel.add(saveButton);

        JButton loadButton = new JButton("Load previous runbud state");
        loadButton.addActionListener(new LoadListener());
        buttonPanel.add(loadButton);

        return buttonPanel;
    }

    // EFFECTS: creates and sets up a display area 
    private void createDisplay() {
        // Display
        display = new JTextArea(20, 5);
        display.setEditable(false);
        display.setFont(new Font("Montserrat", Font.PLAIN, 15));
        display.setLineWrap(true);
        
        imageLabel = new JLabel();
        imageLabel.setPreferredSize(new Dimension(600, 600));
        JPanel displayPanel = new JPanel();
        displayPanel.setLayout(new BorderLayout());
        displayPanel.add(new JScrollPane(display), BorderLayout.CENTER);
        displayPanel.add(imageLabel, BorderLayout.WEST); 
    
        add(displayPanel, BorderLayout.CENTER);

    }

    // MODIFIES: this
    // EFFECTS: adds inputPanel and buttonRow to the GUI
    private void addComponent(JPanel inputPanel, JPanel buttonRow) {
        // Components
        JPanel upPanel = new JPanel();
        upPanel.setLayout(new BorderLayout());
        upPanel.add(inputPanel, BorderLayout.NORTH);
        upPanel.add(buttonRow, BorderLayout.CENTER);
        add(upPanel, BorderLayout.NORTH);
        //add(new JScrollPane(display), BorderLayout.SOUTH);
    }

    // MODIFIES: runbud, display, imageLabel
    // EFFECTS: logs a new run, shows feedback on display, shows image
    private class LogListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            String title = titleField.getText();
            double distance = Double.parseDouble(distanceField.getText());
            double pace = Double.parseDouble(paceField.getText());
            String date = dateField.getText();
            String location = locationField.getText();
            String statusStr = statusField.getText();
            boolean status = Boolean.parseBoolean(statusStr);
            runbud.logRun(title, distance, pace, date, location, status);
            display.setText("Run logged successfully!");
            ImageIcon imageCheck = new ImageIcon("./src/images/good.jpeg");
            imageLabel.setIcon(imageCheck);
        }
    }

    // MODIFIES: runbud, display, imageLabel
    // EFFECTS: adds a new run to challenge, shows feedback on display, shows image
    private class ChallengeListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            String title = titleField.getText();
            double distance = Double.parseDouble(distanceField.getText());
            double pace = Double.parseDouble(paceField.getText());
            String date = dateField.getText();
            String location = locationField.getText();
            String statusStr = statusField.getText();
            boolean status = Boolean.parseBoolean(statusStr);
            runbud.beginChallenge(title, distance, pace, date, location, status);
            display.setText("Challenge has been set");
            display.setText(runbud.viewChallenge());
            ImageIcon imageCheck = new ImageIcon("./src/images/smallcheck.jpeg");
            imageLabel.setIcon(imageCheck);
        }
    }

    // MODIFIES: display
    // EFFECTS: shows challenge info on the display
    private class ViewListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            display.setText(runbud.viewChallenge());
        }
    }

    // MODIFIES: runbud, display, imageLabel
    // EFFECTS: Changes run status, shows feedback on display, shows image 
    private class StatusListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            int no = Integer.parseInt(JOptionPane.showInputDialog("Enter run number"));
            runbud.changeStatus(no);
            display.setText("Status changed");
            ImageIcon imageCheck = new ImageIcon("./src/images/good.jpeg");
            imageLabel.setIcon(imageCheck);
        }
    }

    // MODIFIES: display
    // EFFECTS: Shows aggregates on display
    private class AggregateListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            display.setText(runbud.showAggregate());
        }
    }

    // MODIFIES: runbud, display, imageLabel
    // EFFECTS: saves current state, shows feedback on display, shows image
    private class SaveListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            runbud.saveState();
            display.setText("Saved state");
            ImageIcon imageCheck = new ImageIcon("./src/images/smallcheck.jpeg");
            imageLabel.setIcon(imageCheck);

        }
    }
    
    // MODIFIES: runbud, display, imageLabel
    // EFFECTS: Loads previous state, shows feedback on display, shows image
    private class LoadListener implements ActionListener {
        @Override
        public void actionPerformed(ActionEvent e) {
            runbud.loadState();
            display.setText("State loaded");
            ImageIcon imageCheck = new ImageIcon("./src/images/smallcheck.jpeg");
            imageLabel.setIcon(imageCheck);

        }
    }

    // private class WindowCloser extends WindowAdapter {
    //     @Override
    //     public void windowClosing(WindowEvent e) {
    //         for (model.Event event : eventLog) {
    //             System.out.println(event.getDescription());
    //         }
    //         System.exit(0);
    //     }
    // }

    private class WindowCloser extends WindowAdapter {
        @Override
        public void windowClosing(WindowEvent e) {
            eventLogDisplay.printEventLog();
            System.exit(0);
        }
    }

}
