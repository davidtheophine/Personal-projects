from PIL import Image, ImageEnhance, ImageFilter
import os

#Declare some useful variables 
path = './static'
pathOut = '/editedImgs'

#Loop iterates through the files(images) in the folder
for filename in os.listdir(path):
    img = Image.open(f"{path}/{filename}")

    edit = img.filter(ImageFilter.SHARPEN) #apply greyscale
    
    #increase contrast
    factor = 1.5
    enhancer = ImageEnhance.Contrast(edit)
    edit = enhancer.enhance(factor)

    clean_name = os.path.splitext(filename)[0] #uses splitext to get the filename

    edit.save(f'.{pathOut}/{clean_name}_edited.jpg') #saves edited img

