#CSV operations using dictionary
import csv
details={}
n=int(input("Enter the limit: "))
for i in range (n):
      name=input("Enter name: ")
      
      salary=float(input("Enter salary: "))
      details[name]=salary


def csvwrite():                             #WRITING INTO CSV FILE
 f1=open('sample.csv','w',newline='')

 wr = csv.writer(f1)
 for key in details.keys():
    wr.writerow([key, details[key]])

 #wr.writerows(details)
 f1.close()

def csvread():                              #READING FROM CSV FILE
    f1=open('sample.csv','r')
    
    rr = csv.reader(f1)
    for row in rr:
        print(row)
    f1.close()



def csv_update():                            #Update the salary of  a particular employee
      
     f1=open('sample.csv','r+')
     rr = dict(csv.reader(f1))
     keylist=rr.keys()
     name=input("Enter the name of employee whose salary to be modified")
     sal=int(input("Enter the new salary"))
     f1.close()
     f2=open('sample.csv','w',newline='')
     wr = csv.writer(f2)
     for i in keylist:
           
           if i==name:
                    rr[i]=sal
                   
                 
                    break
           '''if i==rr[len(keylist)-1]:
                 print("Sorry")'''
     
     for key in rr.keys():
          wr.writerow([key, rr[key]])
     
     f2.close()

     
     
def csv_search():                            #Search for  a particular employee's salary
      
     f1=open('sample.csv','r+')
     rr = dict(csv.reader(f1))
     keylist=rr.keys()
     name=input("Enter the name of employee whose salary to be searched")
     
    # wr = csv.writer(f1)
     
     for i in keylist:
           
           if i==name:
                    
                print("Salary is",rr[i])
                 
                break
           '''if i==rr[len(keylist)-1]:
                 print("Sorry")'''

csvwrite()
csvread()
csv_search()
csv_update()
csvread()
