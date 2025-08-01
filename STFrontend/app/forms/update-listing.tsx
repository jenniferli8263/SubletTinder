import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import ListingForm, { ListingFormData } from "@/components/ListingForm";
import { apiGet, apiPatch } from "@/lib/api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { uploadPhotosToCloudinary } from "@/lib/imageUtils";

export default function UpdateListingScreen() {
  const { listingId } = useLocalSearchParams();
  const [initialValues, setInitialValues] = useState<ListingFormData | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [originalPhotos, setOriginalPhotos] = useState<{ url: string; label: string }[]>([]);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const listing = await apiGet(`/listings/${listingId}`);
        console.log(listing);
        // Parse photos and amenities
        const parsedPhotos = JSON.parse(listing.photos || "[]");
        // Convert to PhotoData for the form
        const photoDataArray = parsedPhotos.map((p: any) => ({ uri: p.url, label: p.label, base64: "" }));
        const parsedAmenities = JSON.parse(listing.amenity_ids || "[]");

        setOriginalPhotos(parsedPhotos.map((p: any) => ({ url: p.url, label: p.label })));

        setInitialValues({
          user_id: listing.user_id, // won't be updated
          start_date: listing.start_date,
          end_date: listing.end_date,
          target_gender: listing.target_gender || "",
          asking_price: listing.asking_price.toString(),
          num_bedrooms: listing.num_bedrooms.toString(),
          num_bathrooms: listing.num_bathrooms.toString(),
          pet_friendly: listing.pet_friendly,
          utilities_incl: listing.utilities_incl,
          description: listing.description,
          building_type_id: listing.building_type_id.toString() || "", // fallback to name string
          amenities: parsedAmenities,
          photos: photoDataArray,
          raw_address: listing.address_string || "", // updated from address_string
        });
      } catch (err) {
        console.error("Failed to load listing", err);
      }
    };

    if (listingId) fetchListing();
  }, [listingId]);

  const handleSubmit = async (formData: ListingFormData) => {
    setLoading(true);
    setMessage("");
    setErrors({});
    console.log("handleSubmit called with formData", formData);

    try {
      // Only process valid photos
      const validPhotos = (formData.photos || []).filter(
        (p) => typeof p.uri === 'string' && p.uri.length > 0
      );
      console.log("validPhotos", validPhotos);

      // 1. New photos (no url, need upload)
      const newPhotos = validPhotos.filter(
        (p) => (!p.uri.startsWith("http")) && typeof p.base64 === 'string' && p.base64.length > 0
      );
      console.log("newPhotos", newPhotos);

      // 2. Existing photos with label changes (url exists, label changed)
      const photosToUpdate = validPhotos.filter((p) => {
        if (!p.uri.startsWith("http")) return false; // not an existing photo
        const orig = originalPhotos.find((op) => op.url === p.uri);
        return orig && orig.label !== p.label;
      });
      console.log("photosToUpdate", photosToUpdate);

      // 3. Deleted photos (url in original but not in new)
      const photosToDelete = originalPhotos
        .filter((orig) => !validPhotos.some((p) => p.uri === orig.url))
        .map((orig) => orig.url);
      console.log("photosToDelete", photosToDelete);

      // Upload only new photos
      let uploadedPhotos: { url: string; label: string }[] = [];
      if (newPhotos.length > 0) {
        uploadedPhotos = await uploadPhotosToCloudinary(newPhotos);
      }
      console.log("uploadedPhotos", uploadedPhotos);

      // Build photos_to_add: all with {url, label} (new uploads)
      const photos_to_add = uploadedPhotos.map((p) => ({ url: p.url, label: p.label }));
      // Build photos_to_update: all with {url, label} (label changes)
      const photos_to_update = photosToUpdate.map((p) => ({ url: p.uri, label: p.label }));

      const payload = {
        start_date: formData.start_date,
        end_date: formData.end_date,
        target_gender: formData.target_gender || null,
        asking_price: Number(formData.asking_price),
        num_bedrooms: Number(formData.num_bedrooms),
        num_bathrooms: Number(formData.num_bathrooms),
        pet_friendly: Boolean(formData.pet_friendly),
        utilities_incl: Boolean(formData.utilities_incl),
        description: formData.description,
        amenities: formData.amenities,
        photos_to_add,
        photos_to_update,
        photos_to_delete: photosToDelete,
      };
      console.log("PATCH payload", payload);
      console.log(listingId);

      await apiPatch(`/listings/${listingId}`, payload);
      setMessage("Listing updated!");
      setShowSuccessModal(true);
    } catch (e: any) {
      let errorMsg = "";
      if (e.message?.includes("chk_term_length")) {
        setErrors({
          check_constraint: "The term length should be at least a month.",
        });
        errorMsg = "The term length should be at least a month.";
      } else if (e.message?.includes("chk_start_date_future")) {
        setErrors({
          check_constraint: "The start date must be in the future.",
        });
        errorMsg = "The start date must be in the future.";
      } else {
        // Try to parse FastAPI validation error for gender
        let userFriendlyMsg = null;
        try {
          const errObj = JSON.parse(e.message);
          if (Array.isArray(errObj.detail)) {
            const missingGender = errObj.detail.find(
              (d: any) =>
                d.loc && d.loc.includes("target_gender") &&
                (d.msg?.toLowerCase().includes("field required") || d.msg?.toLowerCase().includes("input should be"))
            );
            if (missingGender) {
              userFriendlyMsg = "Target gender must be specified.";
            }
          }
        } catch {}
        setMessage(userFriendlyMsg || e.message || "Error updating listing");
        errorMsg = userFriendlyMsg || e.message || "Error updating listing";
      }
      setErrorModalMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  if (!initialValues)
    return (
      <View className="bg-white flex-1">
        <Text>Error Loading Form</Text>
      </View>
    );

  return (
    <View className="flex-1 bg-white">
      <TouchableOpacity onPress={() => router.back()} className="p-2 mx-2">
        <MaterialIcons name="arrow-back" size={24} color="#166534" />
      </TouchableOpacity>
      <ListingForm
        type="update"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        loading={loading}
        message={message}
        submitLabel="Update Listing"
        externalErrors={errors}
        //key={JSON.stringify(errors)}
      />
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              padding: 32,
              borderRadius: 16,
              alignItems: "center",
              minWidth: 250,
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16, color: "#b91c1c" }}
            >
              {errorModalMessage}
            </Text>
            <TouchableOpacity
              className="mb-2 rounded-lg bg-green-800 px-4 py-3 items-center"
              onPress={() => setShowErrorModal(false)}
            >
              <Text className="text-white font-bold text-lg">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)" }}>
          <View style={{ backgroundColor: "white", padding: 32, borderRadius: 16, alignItems: "center", minWidth: 250 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>
              Listing updated!
            </Text>
            <TouchableOpacity
              className="mb-2 rounded-lg bg-green-800 px-4 py-3 items-center"
              onPress={() => {
                setShowSuccessModal(false);
                router.replace("/(tabs)"); // or router.back() if you want to go back
              }}
            >
              <Text className="text-white font-bold text-lg">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
