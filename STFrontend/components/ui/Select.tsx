import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  SafeAreaView,
  Keyboard,
} from "react-native";

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number;
  onValueChange: (value: string | number) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}

const Select = ({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className = "",
  searchPlaceholder = "Search...",
  searchable = true,
  disabled = false,
}: SelectProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFilteredOptions(
      search && searchable
        ? options.filter((o) =>
            o.label.toLowerCase().includes(search.toLowerCase())
          )
        : options
    );
  }, [search, options, searchable]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  // Animate modal content on open
  useEffect(() => {
    if (modalVisible) {
      slideAnim.setValue(400);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [modalVisible]);

  return (
    <>
      {/* Main select box */}
      <TouchableOpacity
        className={`mb-3 border rounded-xl px-3 py-4 min-h-[42px] justify-center 
          ${
            disabled
              ? "bg-gray-200 border-gray-200"
              : "bg-gray-100 border-gray-300"
          } ${className}`}
        onPress={() => {
          Keyboard.dismiss();
          if (!disabled) setModalVisible(true);
        }}
        activeOpacity={disabled ? 1 : 0.8}
      >
        <Text
          style={{
            color: disabled ? "#9ca3af" : selectedLabel ? "#222222" : "#888888",
          }}
        >
          {selectedLabel || placeholder}
        </Text>
      </TouchableOpacity>
      {/* Modal for options */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/40"
            onPress={() => {
              setModalVisible(false);
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                opacity: opacityAnim,
                transform: [{ translateY: slideAnim }],
                maxHeight: "70%",
              }}
            >
              <SafeAreaView
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                }}
              >
                <View className="bg-white rounded-t-2xl p-4 pt-8">
                  {/* Search bar */}
                  {searchable && (
                    <TextInput
                      className="bg-gray-100 border border-gray-300 rounded px-3 py-3 mb-3"
                      placeholder={searchPlaceholder}
                      value={search}
                      onChangeText={setSearch}
                      autoFocus
                    />
                  )}
                  {/* Options list */}
                  <FlatList
                    data={filteredOptions}
                    keyExtractor={(item) => String(item.value)}
                    renderItem={({ item }) => (
                      <Pressable
                        className="px-3 py-3 border-b border-gray-100"
                        onPress={() => {
                          onValueChange(item.value);
                          setModalVisible(false);
                          setSearch("");
                        }}
                      >
                        <Text
                          className={
                            value === item.value
                              ? "text-green-700 font-bold"
                              : "text-gray-800"
                          }
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    )}
                    style={{ maxHeight: 250 }}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
              </SafeAreaView>
            </Animated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

export default Select;
