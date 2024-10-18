**Runbud**
================

**What will the application do?**
--------------------------------

* The application will allow you to keep track of the different runs you go on and their specifications including the run distance, route, pace, location etc. It also allows you to set challenges/goals that you can work towards. You can also view your aggregated statistics from your past logged runs.

**Who will use it?**
-------------------

* Anyone who likes running and would like to keep track of their runs to stay motivated.

**Why is this project of interest to you?**
-----------------------------------------

* I am a runner and I would love to make my own version taking inspiration from the running app I use.

## User stories
* I want to be able to log the my run.
* I want to create a run challenge for myself.
* I want to see the total distance I have run.
* I want to see my average pace.
* I want to see my average distance run.

* As a user, I want to be able to save my Challenge to file (if I so choose)
* As a user, I want to be able to be able to load my Challenge from file (if I so choose)

# Instructions for Grader

- You can generate the first required action related to the user story "adding multiple Xs to a Y" by typing information into the indicted fields and then pressing either the "log run" or "Begin/add to challenge" button. Then press Aggregate Logged runs to view aggregated statistics
- You can generate the second required action related to the user story "adding multiple Xs to a Y" by pressing the "Change Run Status" button and then inputing the required run number. Then press view challenge to see that the run status has been change.
- You can locate my visual component by looking at the icons that appear on the left when logging runs, adding to challege, loading challenge etc.
- You can save the state of my application by pressing Save runbud state.
- You can reload the state of my application by Load previous runbud state.

# Phase 4: Task 3
- I feel like my RunbudGUI class can be heavily refactored. The RunbudGUI class is responsible for both GUI related tasks and event log management. This can be separated into separate classes.
- I would also introduce a more distinct type hierarchy so that I would need to make less changes if I wanted to add an extra feature.
- I would also refactor my RunBud class as it seems to be doing way too many things and does not follow the single purpose principle.
- I would also make use of interfaces and abstract classes to reduce the redundancy in my Runbud and RunbudGUI class.