#!/bin/sh

if [ "${1:-"NULL"}" = "-f" ]
then
	MAJ_FORCE="OUI"
	echo "MAJ_FORCE = OUI"
else
	echo "Pas de MaJ forcee ${1:-"NULL"} <> -f ..."
fi

# Titres des pages HTML
# ---------------------------

# RECEPTION
annonces_de="Kunden DFU"

scans_de="Fichiers Collas"

AnnoncesCarrierIOD_de="IOD Carrier Announce Files"

# EMISSION
extractions_de="Sent IOD"

refclients_de="Ref. clients"

ExtractionAnnonceCarrier_de="Sent IOD To Carrier"

integration_de="Integration Reports"
collas_de="C.R. Collas"

IntegrationIODCarrier_de="IOD Carrier Integration Reports"


impression_de="Printout Documents"




une_bu="de"
	
      echo "Generation des fichiers html pour la B.U. <$une_bu>..."
	for un_type_data in scans annonces collas extractions impression integration refclients IntegrationIODCarrier AnnoncesCarrierIOD ExtractionAnnonceCarrier saisie1SAP2MGlots CrINTGsaisie1SAP2MGlots saisie2MGlots2SAP CrINTGsaisie2MGlots2SAP
	do
		case $un_type_data in
		"scans"|"annonces"|"collas"|"extractions"|"impression"|"integration"|"refclients"|"IntegrationIODCarrier"|"AnnoncesCarrierIOD"|"ExtractionAnnonceCarrier"|"saisie1SAP2MGlots"|"CrINTGsaisie1SAP2MGlots"|"saisie2MGlots2SAP"|"CrINTGsaisie2MGlots2SAP")
			TITRE=$(eval echo \$${un_type_data}_${une_bu})
			;;
		*)
			TITRE="Unknown type files"
			;;
		esac
		if [ "${un_type_data}" = "annonces" ] || [ "${un_type_data}" = "AnnoncesCarrierIOD" ]
		then
		(
			cat  $APF_HOME/bibdata/gen.header.annonces | sed -e "s/_BU_/${une_bu}/" -e "s/_TITRE_/${TITRE}/"
			grep -i "^${une_bu};${un_type_data};" $APF_HOME/bibdata/APD_URL.csv | \
				while read ligne
				do
					une_url=$(echo "$ligne" | cut -d\; -f4)
					un_libelle=$(echo "$ligne" | cut -d\; -f3)
					un_mail=$(echo "$ligne" | cut -d\; -f5)
					####echo "<li><a href=\"http://${une_url}\" target=\"_self\">${un_libelle}</a></li>"
					echo "<tr><td style=\"width:50%; background-color: #eaeaea;\"><a href=\"http://${une_url}\" target=\"_self\">${un_libelle}</a></td><td style=\"background-color: #eaeaea;\"><a href=\"mailto:${un_mail}\">${un_mail}</a></td></tr>"
				done
			cat  $APF_HOME/bibdata/gen.footer.annonces
			) > /tmp/${une_bu}_gen.${un_type_data}.html

		else
		(
			cat  $APF_HOME/bibdata/gen.header | sed -e "s/_BU_/${une_bu}/" -e "s/_TITRE_/${TITRE}/"
			grep -i "^${une_bu};${un_type_data};" $APF_HOME/bibdata/APD_URL.csv | \
				while read ligne
				do
					une_url=$(echo "$ligne" | cut -d\; -f4)
					un_libelle=$(echo "$ligne" | cut -d\; -f3)
					echo "<li><a href=\"http://${une_url}\" target=\"_self\">${un_libelle}</a></li>"
				done
			cat  $APF_HOME/bibdata/gen.footer
			) > /tmp/${une_bu}_gen.${un_type_data}.html
		fi
		ls -ltr /tmp/${une_bu}_gen.${un_type_data}.html
		if [ "$MAJ_FORCE" = "OUI" ]
		then
			echo "Copie dans $APF_HOME/APD/APD/${une_bu}/gen.${un_type_data}.html..."
			mv -f /tmp/${une_bu}_gen.${un_type_data}.html $APF_HOME/APD/APD/${une_bu}/gen.${un_type_data}.html
		else
			echo "Pas de MaJ forcee..."
		fi
	done
	echo "OK"



