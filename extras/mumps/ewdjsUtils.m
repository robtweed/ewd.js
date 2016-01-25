ewdjsUtils ; EWD.js Utility methods, functions and tests
 ;
 ; ----------------------------------------------------------------------------
 ; | EWD.js                                                                   |
 ; | Copyright (c) 2013-16 M/Gateway Developments Ltd,                        |
 ; | Reigate, Surrey UK.                                                      |
 ; | All rights reserved.                                                     |
 ; |                                                                          |
 ; | http://www.mgateway.com                                                  |
 ; | Email: rtweed@mgateway.com                                               |
 ; |                                                                          |
 ; | Licensed under the Apache License, Version 2.0 (the "License");          |
 ; | you may not use this file except in compliance with the License.         |
 ; | You may obtain a copy of the License at                                  |
 ; |                                                                          |
 ; |     http://www.apache.org/licenses/LICENSE-2.0                           |
 ; |                                                                          |
 ; | Unless required by applicable law or agreed to in writing, software      |
 ; | distributed under the License is distributed on an "AS IS" BASIS,        |
 ; | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. |
 ; | See the License for the specific language governing permissions and      |
 ; |  limitations under the License.                                          |
 ; ----------------------------------------------------------------------------
 ;
 ; Build 4: 24 January 2016
 ;
 ;QUIT
 ;
 ; External messaging
 ;
 ;  Example of message to be sent to all users of a specific application
 ;
 ;  s array("type")="fromGTM1"
 ;  s array("password")="keepThisSecret!"
 ;  s array("recipients")="byApplication"
 ;  s array("application")="portalRegRequest"
 ;  s array("message","x")=123
 ;  s array("message","y","z")="hello world"
 ;   etc
 ;
 ;  Example of message to be sent to all users
 ;
 ;  s array("type")="fromGTM2"
 ;  s array("password")="keepThisSecret!"
 ;  s array("recipients")="all"
 ;  s array("message","x")=123
 ;  s array("message","y","z")="hello world"
 ;   etc
 ;
 ;  Example of message to be sent to anyone matching a session name/value pair
 ;
 ;  s array("type")="fromGTM3"
 ;  s array("password")="keepThisSecret!"
 ;  s array("recipients")="bySessionValue"
 ;  s array("session",1,"name")="username"
 ;  s array("session",1,"value")="rob"
 ;  s array("message","x")=123
 ;  s array("message","y","z")="hello world"
 ;   etc
 ;
sendExternalMessage(array,port,ipAddress)
 ;
 n dev,json
 ;
 i $g(ipAddress)="" s ipAddress="127.0.0.1"
 s json=$$arrayToJSON("array")
 i json'="" d
 . i $zv["GT.M" d
 . . s dev=$$openTCP(ipAddress,port,5)
 . . u dev w json
 . . c dev
 . e  d
 . . s dev="|TCP|"_port
 . . o dev:(ipAddress:port:"PST"):5 e  q
 . . u dev w json
 . . c dev
 QUIT
 ;
externalMessageTest(type,port,password)
 n array
 i $g(password)="" s password="keepThisSecret!"
 i $g(port)="" s port=10000
 i type=1 d
 . s array("type")="fromGTM1"
 . s array("password")=password
 . s array("recipients")="all"
 . s array("message","x")=123
 . s array("message","y","z")="hello world"
 i type=2 d
 . s array("type")="fromGTM2"
 . s array("password")=password
 . s array("recipients")="all"
 . s array("message","x")=123
 . s array("message","y","z")="hello world"
 i type=3 d
 . s array("type")="fromGTM3"
 . s array("password")=password
 . s array("recipients")="bySessionValue"
 . s array("session",1,"name")="username"
 . s array("session",1,"value")="zzg38984"
 . s array("session",2,"name")="ewd_appName"
 . s array("session",2,"value")="portal"
 . s array("message","x")=123
 . s array("message","y","z")="hello world"
 d sendExternalMessage(.array,port)
 QUIT
 ;
openTCP(host,port,timeout)	
 n delim,dev
 i host'?1N.N1"."1N.N1"."1N.N1"."1N.N,'$$validDomain(host) QUIT 0
 i $g(host)="" QUIT 0
 i $g(port)="" QUIT 0
 i $g(timeout)="" s timeout=20
 s delim=$c(13)
 s dev="client$"_$p($h,",",2)
 o dev:(connect=host_":"_port_":TCP":attach="client":exception="g tcperr":nowrap):timeout:"SOCKET" 
 QUIT dev
 ;
validDomain(domain)	
 ;
 n exists,io,ok,line,stop,temp
 s io=$io
 s temp="temp"_$p($h,",",2)_".txt"
 zsystem "nslookup "_domain_" >"_temp
 o temp:(readonly:exception="g nsFileNotExists") 
 u temp
 s stop=0,exists=0
 f  r line d  q:stop 
 . i line["authoritative answer" s stop=1,exists=1 q
 . i line["server can't find" s stop=1,exists=0 q
 c temp
 u io
 s ok=$$deleteFile(temp)
 QUIT exists
 ;
nsFileNotExists	
 u io
 i $p($zs,",",1)=2 QUIT -1
 QUIT -1
 ;
deleteFile(filePath)
 o filepath:(readonly:exception="g deleteNotExists") 
 c filepath:DELETE
 QUIT 1
 ;
deleteNotExists
 QUIT 0
 ;
arrayToJSON(name)
 n subscripts
 i '$d(@name) QUIT "[]"
 QUIT $$walkArray("",name)
 ;
walkArray(json,name,subscripts)
 ;
 n allNumeric,arrComma,brace,comma,count,cr,dd,i,no,numsub,dblquot,quot
 n ref,sub,subNo,subscripts1,type,valquot,value,xref,zobj
 ;
 s cr=$c(13,10),comma=","
 s (dblquot,valquot)=""""
 s dd=$d(@name)
 i dd=1!(dd=11) d  i dd=1 QUIT json
 . s value=@name
 . i value'[">" q
 . s json=$$walkArray(json,value,.subscripts)
 s ref=name_"("
 s no=$o(subscripts(""),-1)
 i no>0 f i=1:1:no d
 . s quot=""""
 . i subscripts(i)?."-"1N.N s quot=""
 . s ref=ref_quot_subscripts(i)_quot_","
 s ref=ref_"sub)"
 s sub="",numsub=0,subNo=0,count=0
 s allNumeric=1
 f  s sub=$o(@ref) q:sub=""  d  q:'allNumeric
 . i sub'?1N.N s allNumeric=0
 . s count=count+1
 . i sub'=count s allNumeric=0
 ;i allNumeric,count=1 s allNumeric=0
 i allNumeric d
 . s json=json_"["
 e  d
 . s json=json_"{"
 s sub=""
 f  s sub=$o(@ref) q:sub=""  d
 . s subscripts(no+1)=sub
 . s subNo=subNo+1
 . s dd=$d(@ref)
 . i dd=1 d
 . . s value=@ref 
 . . i 'allNumeric d
 . . . s json=json_""""_sub_""":"
 . . s type="literal"
 . . i $$numeric(value) s type="numeric"
 . . ;i value?1N.N s type="numeric"
 . . ;i value?1"-"1N.N s type="numeric"
 . . ;i value?1N.N1"."1N.N s type="numeric"
 . . ;i value?1"-"1N.N1"."1N.N s type="numeric"
 . . i value="true"!(value="false") s type="boolean"
 . . i $e(value,1)="{",$e(value,$l(value))="}" s type="variable"
 . . i $e(value,1,4)="<?= ",$e(value,$l(value)-2,$l(value))=" ?>" d
 . . . s type="variable"
 . . . s value=$e(value,5,$l(value)-3)
 . . i type="literal" s value=valquot_value_valquot
 . . d
 . . . s json=json_value_","
 . k subscripts1
 . m subscripts1=subscripts
 . i dd>9 d
 . . i sub?1N.N,allNumeric d
 . . . i subNo=1 d
 . . . . s numsub=1
 . . . . s json=$e(json,1,$l(json)-1)
 . . . . s json=json_"["
 . . e  d
 . . . s json=json_""""_sub_""":"
 . . s json=$$walkArray(json,name,.subscripts1)
 . . d
 . . . s json=json_","
 ;
 s json=$e(json,1,$l(json)-1)
 i allNumeric d
 . s json=json_"]"
 e  d
 . s json=json_"}"
 QUIT json ; exit!
 ;
numeric(value)
 i $e(value,1,9)="function(" QUIT 1
 i value?1"0."1N.N QUIT 1
 i $e(value,1)=0,$l(value)>1 QUIT 0
 i $e(value,1,2)="-0",$l(value)>2,$e(value,1,3)'="-0." QUIT 0
 i value?1N.N QUIT 1
 i value?1"-"1N.N QUIT 1
 i value?1N.N1"."1N.N QUIT 1
 i value?1"-"1N.N1"."1N.N QUIT 1
 i value?1"."1N.N QUIT 1
 i value?1"-."1N.N QUIT 1
 QUIT 0
 ;
clearSymbolTable() ;
 k
 QUIT 1
 ;
saveSymbolTable(%zzg) ;
 ; Save Symbol Table to specified global node (%zzg)
 ; %zzg is of form "^gloName(""sub1"",""sub2"")"
 ; %zzg must specify at least one subscript
 ;
 k @%zzg
 i $zv["GT.M" d  QUIT 1
 . n %zzx,%zzz
 . s %zzg=$e(%zzg,1,$l(%zzg)-1)
 . s %zzz="%"
 . f  s %zzz=$o(@%zzz) q:%zzz=""  d  h 0
 . . i %zzz="%zzz"!(%zzz="%zzx")!(%zzz="%zzg") q
 . . s %zzx="m "_%zzg_",%zzz)=@%zzz"
 . . x %zzx
 ;
 QUIT $zu(160,1,%zzg)
 ;
restoreSymbolTable(gloRef) ;
 ; Restore Symbol Table from specified global node
 ; gloRef is of form "^gloName(""sub1"",""sub2"")"
 ; gloRef must specify at least one subscript
 ;
 k (gloRef)
 i $zv["GT.M" d  QUIT 1
 . n %zzx,%zzz
 . s gloRef=$e(gloRef,1,$l(gloRef)-1)
 . s %zzz=""
 . f  d  h 0 q:%zzz=""
 . . s %zzx="s %zzz=$o("_gloRef_",%zzz))"
 . . x %zzx
 . . i %zzz'="" m @%zzz=^(%zzz)
 ;
 QUIT $zu(160,0,gloRef)
 ;
getSessionSymbolTable(sessid) ;
 ;
 n gloRef
 ;
 s gloRef="^%zewdSession(""session"","_sessid_",""ewd_symbolTable"")"
 i $$restoreSymbolTable(gloRef)
 k %zzg
 QUIT "ok"
 ;
