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
annonces_fr="Fichiers Annonces"
annonces_it="Announce Files"
annonces_pl="Announce Files"
annonces_ua="Announce Files"
annonces_hr="Announce Files"
annonces_si="Announce Files"
annonces_lt="Announce Files"
annonces_ib="Announce Files"

scans_fr="Fichiers Collas"
scans_it="Fichiers Collas"
scans_pl="Fichiers Collas"
scans_ua="Fichiers Collas"
scans_hr="Fichiers Collas"
scans_si="Fichiers Collas"
scans_lt="Fichiers Collas"
scans_ib="Fichiers Collas"

AnnoncesCarrierIOD_fr="Fichiers Annonces IOD sous-traitants"
AnnoncesCarrierIOD_it="IOD Carrier Announce Files"
AnnoncesCarrierIOD_pl="IOD Carrier Announce Files"
AnnoncesCarrierIOD_ua="IOD Carrier Announce Files"
AnnoncesCarrierIOD_hr="IOD Carrier Announce Files"
AnnoncesCarrierIOD_si="IOD Carrier Announce Files"
AnnoncesCarrierIOD_lt="IOD Carrier Announce Files"
AnnoncesCarrierIOD_ib="IOD Carrier Announce Files"

# EMISSION
extractions_fr="IOD emis"
extractions_it="Sent IOD"
extractions_pl="Sent IOD"
extractions_ua="Sent IOD"
extractions_hr="Sent IOD"
extractions_si="Sent IOD"
extractions_lt="Sent IOD"
extractions_ib="Sent IOD"

refclients_fr="Ref. clients"
refclients_it="Ref. clients"
refclients_pl="Ref. clients"
refclients_ua="Ref. clients"
refclients_hr="Ref. clients"
refclients_si="Ref. clients"
refclients_lt="Ref. clients"
refclients_ib="Ref. clients"

ExtractionAnnonceCarrier_fr="IOD emis vers sous-traitants"
ExtractionAnnonceCarrier_it="Sent IOD To Carrier"
ExtractionAnnonceCarrier_pl="Sent IOD To Carrier"
ExtractionAnnonceCarrier_ua="Sent IOD To Carrier"
ExtractionAnnonceCarrier_hr="Sent IOD To Carrier"
ExtractionAnnonceCarrier_si="Sent IOD To Carrier"
ExtractionAnnonceCarrier_lt="Sent IOD To Carrier"
ExtractionAnnonceCarrier_ib="Sent IOD To Carrier"

# Comptes Rendus d'Intégration
integration_fr="C.R. d'Integration"
integration_it="Integration Reports"
integration_pl="Integration Reports"
integration_ua="Integration Reports"
integration_hr="Integration Reports"
integration_si="Integration Reports"
integration_lt="Integration Reports"
integration_ib="Integration Reports"

collas_fr="C.R. Collas"
collas_it="C.R. Collas"
collas_pl="C.R. Collas"
collas_ua="C.R. Collas"
collas_hr="C.R. Collas"
collas_si="C.R. Collas"
collas_lt="C.R. Collas"
collas_ib="C.R. Collas"

IntegrationIODCarrier_fr="C.R. d'Integration IOD Sous-Traitants"
IntegrationIODCarrier_it="IOD Carrier Integration Reports"
IntegrationIODCarrier_pl="IOD Carrier Integration Reports"
IntegrationIODCarrier_ua="IOD Carrier Integration Reports"
IntegrationIODCarrier_hr="IOD Carrier Integration Reports"
IntegrationIODCarrier_si="IOD Carrier Integration Reports"
IntegrationIODCarrier_lt="IOD Carrier Integration Reports"
IntegrationIODCarrier_ib="IOD Carrier Integration Reports"


# Documents Disponibles pour l'Impression
impression_fr="Documents generes"
impression_it="Printout Documents"
impression_pl="Printout Documents"
impression_ua="Printout Documents"
impression_hr="Printout Documents"
impression_si="Printout Documents"
impression_lt="Printout Documents"
impression_ib="Printout Documents"


# Interfaces SAP -> MG LOTS
saisie1SAP2MGlots_fr="FICHIERS INTERFACES SAP -> MG LOTS" 
CrINTGsaisie1SAP2MGlots_fr="CR int. saisie1 (SAP -> MG Lots)"
# Interfaces MG LOTS -> SAP
saisie2MGlots2SAP_fr="FICHIERS INTERFACES MG LOTS -> SAP" 
CrINTGsaisie2MGlots2SAP_fr="CR int. saisie2 (MG Lots -> SAP)"


for une_bu in fr it pl ua hr si lt ib 
do
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
			grep -i "^${une_bu};${un_type_data};" $APF_HOME/bibdata/APF_URL.csv | \
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
			grep -i "^${une_bu};${un_type_data};" $APF_HOME/bibdata/APF_URL.csv | \
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
			echo "Copie dans $APF_HOME/APF/${une_bu}/gen.${un_type_data}.html..."
			mv -f /tmp/${une_bu}_gen.${un_type_data}.html $APF_HOME/APF/${une_bu}/gen.${un_type_data}.html
		else
			echo "Pas de MaJ forcee..."
		fi
	done
	echo "OK"
done



