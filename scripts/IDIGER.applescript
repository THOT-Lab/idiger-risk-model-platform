-- IDIGER : démarre le serveur local de la plateforme si besoin, puis l'ouvre en plein écran dans sa propre fenêtre.
set devDir to "/Users/laurentpacoud/Desktop/IDIGER Risk Model Platform/DEV"
set nodePath to "/usr/local/bin/node"
set siteURL to "http://127.0.0.1:5180/"
set profileDir to (POSIX path of (path to home folder)) & "Library/Application Support/IDIGER/Chrome"
set logFile to (POSIX path of (path to home folder)) & "Library/Logs/IDIGER.log"

on serverReady(siteURL)
	try
		do shell script "curl -s --max-time 1 " & quoted form of siteURL & " | grep -q 'IDIGER'"
		return true
	on error
		return false
	end try
end serverReady

if not serverReady(siteURL) then
	-- Construit l'application si dist/ manque, puis sert dist/ (vite preview) en arrière-plan.
	do shell script "cd " & quoted form of devDir & " && export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH && ( [ -f dist/index.html ] || npm run build ) > " & quoted form of logFile & " 2>&1; (exec nohup " & quoted form of nodePath & " node_modules/.bin/vite preview --host 127.0.0.1 --port 5180 --strictPort) >> " & quoted form of logFile & " 2>&1 < /dev/null &"
	repeat 60 times
		if serverReady(siteURL) then exit repeat
		delay 0.25
	end repeat
	if not serverReady(siteURL) then
		display dialog "IDIGER n'a pas pu démarrer. Détails dans " & logFile buttons {"OK"} default button 1 with icon stop
		return
	end if
end if

do shell script "mkdir -p " & quoted form of profileDir
-- Profil Chrome dédié : fenêtre d'application autonome (sans onglets ni barre d'adresse), en plein écran.
do shell script "open -na 'Google Chrome' --args --user-data-dir=" & quoted form of profileDir & " --app=" & quoted form of siteURL & " --start-fullscreen --no-first-run --no-default-browser-check"
