#python -m pip install deep-translator
from deep_translator import GoogleTranslator as Translate
import json

target_language=['zh','TW']

new_text={}
source_text={}
with open('./last-strings.json','r',encoding='utf-8')as source:
    try:
        source_text=json.load(source)
    except Exception as e:
        print('JSON file is malformed.',e)
        exit()

tot=len(source_text.keys())
# for x,i in enumerate(source_text):
#     print(f'{i} ({x}/{tot})')
#     new_text[i]=Translate(source='en', target=target_language[0]).translate(source_text[i])


import threading
from concurrent.futures import ProcessPoolExecutor
import os
results = {}
lock = threading.Lock()

def worker(inp):
    x,i=inp
    global new_text
    print(f'{i} ({x+1}/{tot})')
    # Safely write to shared dict
    # with lock:
    return (i,Translate(source='en', target="-".join(target_language)).translate(source_text[i]))

threads = []
if __name__ == '__main__':
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
        dat=executor.map(worker, enumerate(source_text))
        for val in dat:
            try:
                k,v=val
                new_text[k]=v
            except Exception as e:
                print('broke',e)
                # print(f'is broke',val)
                pass
        
        print('is working!')

    print("done?",len(new_text.keys()))
    with open(f'./strings_new.{target_language[0]}-{target_language[1]}.json','w')as final_file:
        json.dump(new_text,final_file,indent=2)